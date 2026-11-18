import {
	type AuthorizationPayload,
	type AuthTokensResponse,
	exchangeAccessCodeForAuthTokens,
	exchangeNpssoForAccessCode,
	exchangeRefreshTokenForAuthTokens,
	getUserPlayedGames,
	getUserTitles,
} from "psn-api";
import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGet,
	cacheSet,
	getRedis,
} from "@/lib/cache/redis";
import { cleanGameName, matchKey } from "@/lib/games/titles";
import { TokenRejectedError, trackRead } from "@/lib/health/reads";
import type { PlatformPlay } from "@/types/gaming";
import type { HistoryGame } from "@/types/history";

// Token cache (in-memory for the current process)
let cachedAuth: AuthorizationPayload | null = null;
let authExpiresAt = 0;

/** Most recently played first, so the first page holds everything recent. */
const PLAYED_GAMES_LIMIT = 100;
/** Page sizes for the full history; both lists are paged to the end. */
const HISTORY_PLAYED_PAGE = 200;
const HISTORY_TROPHY_PAGE = 800;
/** A stop for a list that never ends: far more pages than the owner has. */
const HISTORY_MAX_PAGES = 20;

interface StoredPsnAuth {
	refreshToken: string;
}

function remember(authResponse: AuthTokensResponse): AuthorizationPayload {
	cachedAuth = { accessToken: authResponse.accessToken };
	authExpiresAt = Date.now() + (authResponse.expiresIn - 60) * 1000;
	return cachedAuth;
}

/**
 * Get valid PSN authentication.
 * The refresh token is kept in Redis; the NPSSO is the fallback.
 */
async function getAuth(): Promise<AuthorizationPayload> {
	if (cachedAuth && Date.now() < authExpiresAt) {
		return cachedAuth;
	}

	const redis = getRedis();
	const stored = await redis.get<StoredPsnAuth>(CACHE_KEYS.PSN_AUTH);

	if (stored?.refreshToken) {
		try {
			const authResponse = await exchangeRefreshTokenForAuthTokens(
				stored.refreshToken,
			);
			await redis.set(CACHE_KEYS.PSN_AUTH, {
				...stored,
				refreshToken: authResponse.refreshToken,
			} satisfies StoredPsnAuth);
			return remember(authResponse);
		} catch (error) {
			console.error("Refresh token failed, falling back to NPSSO:", error);
		}
	}

	const npsso = process.env.PSN_NPSSO;
	if (!npsso) {
		throw new Error("PSN_NPSSO not configured");
	}

	let authResponse: AuthTokensResponse;
	try {
		const accessCode = await exchangeNpssoForAccessCode(npsso);
		authResponse = await exchangeAccessCodeForAuthTokens(accessCode);
	} catch (error) {
		// psn-api's own words for an NPSSO that Sony no longer accepts
		if (String(error).includes("Is your NPSSO code valid")) {
			throw new TokenRejectedError("PSN rejected the NPSSO");
		}
		throw new Error(`PSN authentication failed: ${error}`);
	}

	await redis.set(CACHE_KEYS.PSN_AUTH, {
		refreshToken: authResponse.refreshToken,
	} satisfies StoredPsnAuth);
	return remember(authResponse);
}

/** Parse an ISO 8601 duration such as "PT228H56M33S" into whole minutes. */
export function parsePlayDuration(duration: string): number | undefined {
	const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(
		duration,
	);
	if (!match) {
		return undefined;
	}
	const [, hours = "0", minutes = "0"] = match;
	return Number(hours) * 60 + Number(minutes);
}

/**
 * Every PlayStation game the owner has played, with last played date and
 * play time. Cached for an hour.
 */
export async function getPlayStationPlays(): Promise<PlatformPlay[]> {
	const cached = await cacheGet<PlatformPlay[]>(CACHE_KEYS.GAMING_PSN);
	if (cached) {
		return cached;
	}

	return trackRead("psn", async () => {
		const auth = await getAuth();
		const response = await getUserPlayedGames(auth, "me", {
			limit: PLAYED_GAMES_LIMIT,
			offset: 0,
		});

		const plays: PlatformPlay[] = (response.titles ?? [])
			.filter(isGame)
			.map((title) => ({
				platform: "playstation" as const,
				name: title.name,
				lastPlayedAt: title.lastPlayedDateTime,
				minutesPlayed: parsePlayDuration(title.playDuration ?? ""),
				imageUrl: title.imageUrl,
			}));

		await cacheSet(CACHE_KEYS.GAMING_PSN, plays, CACHE_TTL.GAMING);
		return plays;
	});
}

interface PlayedTitle {
	name: string;
	category?: string;
	playDuration?: string;
}

interface TrophyTitle {
	trophyTitleName: string;
	earnedTrophies?: {
		bronze?: number;
		silver?: number;
		gold?: number;
		platinum?: number;
	};
}

/** The rest of the played list are apps such as Netflix and Plex. */
function isGame(title: { category?: string }): boolean {
	return Boolean(title.category?.includes("game"));
}

/**
 * The owner's whole PlayStation history: the games in the played list, in
 * union with the trophy list. A trophy title adds its earned trophies to the
 * played game of the same name; one with no counterpart, mostly a game
 * inside a collection, is kept on its own with no play time.
 */
export function mergePsnHistory(
	played: PlayedTitle[],
	trophies: TrophyTitle[],
): HistoryGame[] {
	const byName = new Map<string, HistoryGame>();
	const history: HistoryGame[] = [];
	for (const title of played.filter(isGame)) {
		const game: HistoryGame = { name: title.name };
		const minutes = parsePlayDuration(title.playDuration ?? "");
		if (minutes !== undefined) {
			game.minutesPlayed = minutes;
		}
		history.push(game);
		byName.set(matchKey(cleanGameName(title.name)), game);
	}
	for (const title of trophies) {
		const {
			bronze = 0,
			silver = 0,
			gold = 0,
			platinum = 0,
		} = title.earnedTrophies ?? {};
		const earned = bronze + silver + gold + platinum;
		const game = byName.get(matchKey(cleanGameName(title.trophyTitleName)));
		if (!game) {
			history.push({ name: title.trophyTitleName, achievements: earned });
		} else if (earned > 0) {
			game.achievements = (game.achievements ?? 0) + earned;
		}
	}
	return history;
}

/** Read a paged list to its end. */
async function allPages<T>(
	pageSize: number,
	getPage: (offset: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
	const all: T[] = [];
	for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
		const { items, total } = await getPage(page * pageSize);
		all.push(...items);
		// To the total PSN reports; a short page ends it only when PSN
		// reports none
		const atEnd = total > 0 ? all.length >= total : items.length < pageSize;
		if (items.length === 0 || atEnd) {
			break;
		}
	}
	return all;
}

/**
 * The owner's whole PlayStation history, for the daily run: about 375
 * played titles and 344 trophy titles. Not cached.
 */
export async function getPlayStationHistory(): Promise<HistoryGame[]> {
	return trackRead("psn", async () => {
		const auth = await getAuth();
		const played = await allPages(HISTORY_PLAYED_PAGE, async (offset) => {
			const response = await getUserPlayedGames(auth, "me", {
				limit: HISTORY_PLAYED_PAGE,
				offset,
			});
			return {
				items: response.titles ?? [],
				total: response.totalItemCount ?? 0,
			};
		});
		const trophies = await allPages(HISTORY_TROPHY_PAGE, async (offset) => {
			const response = await getUserTitles(auth, "me", {
				limit: HISTORY_TROPHY_PAGE,
				offset,
			});
			return {
				items: response.trophyTitles ?? [],
				total: response.totalItemCount ?? 0,
			};
		});
		return mergePsnHistory(played, trophies);
	});
}
