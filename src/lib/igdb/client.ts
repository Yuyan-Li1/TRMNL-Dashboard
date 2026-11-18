import { matchKey } from "@/lib/games/titles";

/**
 * IGDB itself, apart from where its token and its answers are kept, so the
 * Collector can ask it too: Vercel keeps both in Redis, the Collector in
 * SQLite. Authenticated with a Twitch app token, which lasts about 60 days.
 * Rate limit: 4 requests per second.
 */
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_URL = "https://api.igdb.com/v4";
export const GAME_FIELDS = [
	"name",
	"cover.image_id",
	"summary",
	"total_rating",
	"first_release_date",
	"platforms.abbreviation",
];
/** IGDB's id for Steam among its external game sources. */
const STEAM_SOURCE_ID = 1;
const REQUEST_SPACING_MS = 300;

export interface IgdbCredentials {
	clientId: string;
	token: string;
}

/** A game as IGDB answers with `GAME_FIELDS`. */
export interface IgdbGame {
	id?: number;
	name: string;
	cover?: { image_id?: string };
	summary?: string;
	total_rating?: number;
	/** Unix seconds */
	first_release_date?: number;
	platforms?: { abbreviation?: string }[];
}

/** IGDB turned the token away: it was revoked early and must be renewed. */
export class IgdbTokenRejectedError extends Error {
	override name = "IgdbTokenRejectedError";
}

interface TwitchToken {
	access_token?: string;
	expires_in?: number;
}

/** Ask Twitch for a new app token. */
export async function requestIgdbToken(
	clientId: string,
	clientSecret: string,
): Promise<{ token: string; expiresInSeconds: number }> {
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
	return { token: body.access_token, expiresInSeconds: body.expires_in };
}

let lastRequestAt = 0;

export async function igdbQuery<T>(
	credentials: IgdbCredentials,
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
		throw new IgdbTokenRejectedError("IGDB request failed: 401");
	}
	if (!response.ok) {
		throw new Error(`IGDB request failed: ${response.status}`);
	}
	return (await response.json()) as T[];
}

/** The year a game was first released, where IGDB knows. */
export function releaseYear(game: IgdbGame): number | undefined {
	return game.first_release_date === undefined
		? undefined
		: new Date(game.first_release_date * 1000).getUTCFullYear();
}

/**
 * Pick the search result that is this game. Only an exact name match is
 * trusted: a near miss would put another game's cover on the screen. A year
 * narrows it to the game first released then.
 */
export function pickByName<T extends IgdbGame>(
	results: T[],
	name: string,
	year?: number,
): T | undefined {
	const wanted = matchKey(name);
	return results.find(
		(result) =>
			matchKey(result.name) === wanted &&
			(year === undefined || releaseYear(result) === year),
	);
}

/**
 * Find a game in IGDB: a Steam game by its app id first, anything else (and
 * a Steam game IGDB does not know by id) by name.
 */
export async function findGame(
	credentials: IgdbCredentials,
	game: { name: string; steamAppId?: string; year?: number },
): Promise<IgdbGame | undefined> {
	if (game.steamAppId) {
		try {
			// Asked of the external-games table so the app id and the Steam
			// source are matched on the same row
			const bySteamId = await igdbQuery<{ game?: IgdbGame }>(
				credentials,
				"external_games",
				`fields ${GAME_FIELDS.map((field) => `game.${field}`).join(",")}; where uid = "${game.steamAppId}" & external_game_source = ${STEAM_SOURCE_ID}; limit 1;`,
			);
			if (bySteamId[0]?.game?.name) {
				return bySteamId[0].game;
			}
		} catch (error) {
			if (error instanceof IgdbTokenRejectedError) {
				throw error;
			}
			console.warn(`IGDB Steam id lookup failed for ${game.name}:`, error);
		}
	}

	const escaped = game.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	const byName = await igdbQuery<IgdbGame>(
		credentials,
		"games",
		`fields ${GAME_FIELDS.join(",")}; search "${escaped}"; limit 10;`,
	);
	return pickByName(byName, game.name, game.year);
}
