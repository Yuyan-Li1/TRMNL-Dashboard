import SteamAPI from "steamapi";
import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import type { RecentGame, SteamData } from "@/types/gaming";

// Lazy singleton SteamAPI instance — avoids reading env at module level
let steamInstance: SteamAPI | null = null;

function getSteamClient(): SteamAPI {
	if (!steamInstance) {
		const apiKey = process.env.STEAM_API_KEY;
		if (!apiKey) {
			throw new Error("STEAM_API_KEY not configured");
		}
		steamInstance = new SteamAPI(apiKey);
	}
	return steamInstance;
}

/**
 * Get Steam data with caching
 * Rate limit: 100,000 requests/day
 */
export async function getSteamData(): Promise<SteamData> {
	// Try cache first
	const cached = await cacheGet<SteamData>(CACHE_KEYS.GAMING_STEAM);
	if (cached) {
		return cached;
	}

	const steamId = process.env.STEAM_ID;
	if (!steamId) {
		throw new Error("STEAM_ID not configured");
	}

	const steam = getSteamClient();

	// Fetch fresh data using steamapi package
	const [userSummary, recentGamesRaw] = await Promise.all([
		steam.getUserSummary(steamId),
		steam.getUserRecentGames(steamId),
	]);

	const recentGames: RecentGame[] = recentGamesRaw.map((entry) => ({
		platform: "steam" as const,
		gameId: entry.game.id.toString(),
		title: entry.game.name,
		imageUrl: entry.game.iconURL,
		lastPlayed: entry.lastPlayedAt?.toISOString(),
		playtimeRecent: entry.recentMinutes,
		playtimeTotal: entry.minutes,
	}));

	const data: SteamData = {
		playerId: steamId,
		playerName: userSummary.nickname,
		avatarUrl: userSummary.avatar.large,
		recentGames,
		fetchedAt: new Date().toISOString(),
	};

	// Cache for 1 hour
	await cacheSet(CACHE_KEYS.GAMING_STEAM, data, CACHE_TTL.GAMING);

	return data;
}
