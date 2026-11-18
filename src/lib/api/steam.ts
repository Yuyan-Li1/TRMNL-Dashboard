import SteamAPI from "steamapi";
import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { trackRead } from "@/lib/health/reads";
import type { PlatformPlay } from "@/types/gaming";

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

/** Steam's portrait library artwork, the Platform's own image for a game. */
function libraryImageUrl(appId: string): string {
	return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
}

/**
 * Every Steam game the owner has played, with last played date and total
 * play time. Cached for an hour.
 * Rate limit: 100,000 requests/day
 */
export async function getSteamPlays(): Promise<PlatformPlay[]> {
	const cached = await cacheGet<PlatformPlay[]>(CACHE_KEYS.GAMING_STEAM);
	if (cached) {
		return cached;
	}

	return trackRead("steam", async () => {
		const steamId = process.env.STEAM_ID;
		if (!steamId) {
			throw new Error("STEAM_ID not configured");
		}

		// The owned-games call is used because it alone carries the last played
		// date; the recently-played call does not.
		const owned = await getSteamClient().getUserOwnedGames(steamId, {
			includeAppInfo: true,
			includeFreeGames: true,
		});

		const plays: PlatformPlay[] = owned
			.filter((entry) => entry.minutes > 0 && entry.lastPlayedAt)
			.map((entry) => {
				const appId = entry.game.id.toString();
				return {
					platform: "steam" as const,
					name: "name" in entry.game ? entry.game.name : appId,
					lastPlayedAt: entry.lastPlayedAt?.toISOString(),
					minutesPlayed: entry.minutes,
					imageUrl: libraryImageUrl(appId),
					steamAppId: appId,
				};
			});

		await cacheSet(CACHE_KEYS.GAMING_STEAM, plays, CACHE_TTL.GAMING);
		return plays;
	});
}
