import { CACHE_KEYS, getRedis } from "@/lib/cache/redis";
import { trackRead } from "@/lib/health/reads";
import {
	findGame,
	GAME_FIELDS,
	igdbQuery,
	type IgdbCredentials,
	type IgdbGame,
	IgdbTokenRejectedError,
	requestIgdbToken,
} from "@/lib/igdb/client";
import type { GameTitle } from "@/types/gaming";

/**
 * IGDB, the Catalog for games, as Vercel uses it: the Twitch app token and
 * every lookup are kept in Redis. IGDB itself is in `@/lib/igdb/client`.
 */
/** Renew the token this long before Twitch expires it. */
const TOKEN_RENEWAL_MARGIN_SECONDS = 24 * 60 * 60;
const MATCH_TTL_SECONDS = 30 * 24 * 60 * 60;
const NO_MATCH_TTL_SECONDS = 24 * 60 * 60;

/** What the Catalog says about a game. */
export interface CatalogGame {
	/** IGDB's id for the game; absent in a lookup stored before it was kept */
	id?: number;
	name: string;
	/** Portrait cover artwork */
	coverUrl?: string;
	description?: string;
	/** Public rating converted to five stars, in half-star steps */
	rating?: number;
	/** The Platforms it is on, as IGDB abbreviates them: "PC", "PS5" */
	platforms?: string[];
}

/** A stored lookup; `game` is null when IGDB had no match. */
interface StoredLookup {
	game: CatalogGame | null;
}

async function getCredentials(): Promise<IgdbCredentials> {
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

	const { token, expiresInSeconds } = await requestIgdbToken(
		clientId,
		clientSecret,
	);
	const ttl = expiresInSeconds - TOKEN_RENEWAL_MARGIN_SECONDS;
	if (ttl > 0) {
		await redis.set(CACHE_KEYS.IGDB_TOKEN, token, { ex: ttl });
	}
	return { clientId, token };
}

/**
 * Ask IGDB as one tracked read. A token IGDB turns away was revoked early:
 * it is dropped, so the next read gets a new one.
 */
export async function askIgdb<T>(
	ask: (credentials: IgdbCredentials) => Promise<T>,
): Promise<T> {
	return trackRead("igdb", async () => {
		try {
			return await ask(await getCredentials());
		} catch (error) {
			if (error instanceof IgdbTokenRejectedError) {
				await getRedis().del(CACHE_KEYS.IGDB_TOKEN);
			}
			throw error;
		}
	});
}

/** Convert IGDB's 0-100 rating to five stars in half-star steps. */
export function toFiveStars(rating: number): number {
	return Math.round(rating / 10) / 2;
}

export function toCatalogGame(game: IgdbGame): CatalogGame {
	const platforms = (game.platforms ?? []).flatMap((platform) =>
		platform.abbreviation ? [platform.abbreviation] : [],
	);
	return {
		id: game.id,
		name: game.name,
		platforms: platforms.length > 0 ? platforms : undefined,
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
	// A match stored before the id was kept is asked for again
	if (stored && (stored.game === null || stored.game.id !== undefined)) {
		return stored.game;
	}

	const found = await askIgdb((credentials) => findGame(credentials, title));
	const game = found ? toCatalogGame(found) : null;
	await redis.set(key, { game } satisfies StoredLookup, {
		ex: game ? MATCH_TTL_SECONDS : NO_MATCH_TTL_SECONDS,
	});
	return game;
}

/**
 * The games IGDB lists as similar to a game, in its order, each with what
 * the Catalog says about it. Not kept: only the daily run asks, once per
 * seed.
 */
export async function getSimilarGames(igdbId: number): Promise<CatalogGame[]> {
	const found = await askIgdb((credentials) =>
		igdbQuery<{ similar_games?: IgdbGame[] }>(
			credentials,
			"games",
			`fields ${GAME_FIELDS.map((field) => `similar_games.${field}`).join(",")}; where id = ${igdbId}; limit 1;`,
		),
	);
	return (found[0]?.similar_games ?? [])
		.filter((game) => game.id !== undefined && game.name)
		.map(toCatalogGame);
}
