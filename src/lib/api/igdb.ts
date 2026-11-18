import { CACHE_KEYS, getRedis } from "@/lib/cache/redis";
import { matchKey } from "@/lib/games/titles";
import { trackRead } from "@/lib/health/reads";
import type { GameTitle } from "@/types/gaming";

/**
 * IGDB, the Catalog for games. Authenticated with a Twitch app token, which
 * lasts about 60 days and is kept in Redis.
 * Rate limit: 4 requests per second.
 */
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_URL = "https://api.igdb.com/v4";
const GAME_FIELDS = ["name", "cover.image_id", "summary", "total_rating"];
/** IGDB's id for Steam among its external game sources. */
const STEAM_SOURCE_ID = 1;
/** Renew the token this long before Twitch expires it. */
const TOKEN_RENEWAL_MARGIN_SECONDS = 24 * 60 * 60;
const MATCH_TTL_SECONDS = 30 * 24 * 60 * 60;
const NO_MATCH_TTL_SECONDS = 24 * 60 * 60;
const REQUEST_SPACING_MS = 300;

/** What the Catalog says about a game. */
export interface CatalogGame {
	name: string;
	/** Portrait cover artwork */
	coverUrl?: string;
	description?: string;
	/** Public rating converted to five stars, in half-star steps */
	rating?: number;
}

interface IgdbGame {
	name: string;
	cover?: { image_id?: string };
	summary?: string;
	total_rating?: number;
}

/** A stored lookup; `game` is null when IGDB had no match. */
interface StoredLookup {
	game: CatalogGame | null;
}

interface TwitchToken {
	access_token?: string;
	expires_in?: number;
}

interface Credentials {
	clientId: string;
	token: string;
}

async function getCredentials(): Promise<Credentials> {
	const clientId = process.env.TWITCH_CLIENT_ID;
	const clientSecret = process.env.TWITCH_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error("TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET not configured");
	}

	const redis = getRedis();
	const stored = await redis.get<string>(CACHE_KEYS.IGDB_TOKEN);
	if (stored) {
		return { clientId, token: stored };
	}

	const response = await fetch(TWITCH_TOKEN_URL, {
		method: "POST",
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "client_credentials",
		}),
	});
	if (!response.ok) {
		throw new Error(`Twitch token request failed: ${response.status}`);
	}
	const body = (await response.json()) as TwitchToken;
	if (!body.access_token || !body.expires_in) {
		throw new Error("Twitch returned no access token");
	}

	const ttl = body.expires_in - TOKEN_RENEWAL_MARGIN_SECONDS;
	if (ttl > 0) {
		await redis.set(CACHE_KEYS.IGDB_TOKEN, body.access_token, { ex: ttl });
	}
	return { clientId, token: body.access_token };
}

let lastRequestAt = 0;

async function query<T>(
	credentials: Credentials,
	endpoint: "games" | "external_games",
	body: string,
): Promise<T[]> {
	const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
	if (wait > 0) {
		await new Promise((resolve) => setTimeout(resolve, wait));
	}
	lastRequestAt = Date.now();

	const response = await fetch(`${IGDB_URL}/${endpoint}`, {
		method: "POST",
		headers: {
			"Client-ID": credentials.clientId,
			Authorization: `Bearer ${credentials.token}`,
			Accept: "application/json",
		},
		body,
	});
	if (response.status === 401) {
		// The stored token was revoked early; the next refresh gets a new one
		await getRedis().del(CACHE_KEYS.IGDB_TOKEN);
	}
	if (!response.ok) {
		throw new Error(`IGDB request failed: ${response.status}`);
	}
	return (await response.json()) as T[];
}

/**
 * Pick the search result that is this game. Only an exact name match is
 * trusted: a near miss would put another game's cover on the screen.
 */
export function pickByName(
	results: IgdbGame[],
	name: string,
): IgdbGame | undefined {
	const wanted = matchKey(name);
	return results.find((result) => matchKey(result.name) === wanted);
}

/** Convert IGDB's 0-100 rating to five stars in half-star steps. */
export function toFiveStars(rating: number): number {
	return Math.round(rating / 10) / 2;
}

function toCatalogGame(game: IgdbGame): CatalogGame {
	return {
		name: game.name,
		coverUrl: game.cover?.image_id
			? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`
			: undefined,
		description: game.summary,
		rating:
			game.total_rating !== undefined
				? toFiveStars(game.total_rating)
				: undefined,
	};
}

async function findGame(
	credentials: Credentials,
	title: GameTitle,
): Promise<IgdbGame | undefined> {
	if (title.steamAppId) {
		try {
			// Asked of the external-games table so the app id and the Steam
			// source are matched on the same row
			const bySteamId = await query<{ game?: IgdbGame }>(
				credentials,
				"external_games",
				`fields ${GAME_FIELDS.map((field) => `game.${field}`).join(",")}; where uid = "${title.steamAppId}" & external_game_source = ${STEAM_SOURCE_ID}; limit 1;`,
			);
			if (bySteamId[0]?.game?.name) {
				return bySteamId[0].game;
			}
		} catch (error) {
			console.warn(`IGDB Steam id lookup failed for ${title.name}:`, error);
		}
	}

	const escaped = title.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	const byName = await query<IgdbGame>(
		credentials,
		"games",
		`fields ${GAME_FIELDS.join(",")}; search "${escaped}"; limit 10;`,
	);
	return pickByName(byName, title.name);
}

/**
 * Look a game Title up in IGDB: a Steam game by its app id first, anything
 * else (and a Steam game IGDB does not know by id) by name. The answer is
 * kept in Redis, a miss for a day and a match for a month.
 */
export async function lookupGame(
	title: GameTitle,
): Promise<CatalogGame | null> {
	const redis = getRedis();
	const key = `igdb:game:${title.id}`;
	const stored = await redis.get<StoredLookup>(key);
	if (stored) {
		return stored.game;
	}

	const found = await trackRead("igdb", async () =>
		findGame(await getCredentials(), title),
	);
	const game = found ? toCatalogGame(found) : null;
	await redis.set(key, { game } satisfies StoredLookup, {
		ex: game ? MATCH_TTL_SECONDS : NO_MATCH_TTL_SECONDS,
	});
	return game;
}
