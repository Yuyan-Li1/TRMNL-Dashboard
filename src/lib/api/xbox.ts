import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import type { RecentGame, XboxData } from "@/types/gaming";

const OPENXBL_BASE = "https://xbl.io/api/v2";

interface XboxProfile {
	profileUsers: Array<{
		id: string;
		settings: Array<{
			id: string;
			value: string;
		}>;
	}>;
}

interface XboxTitleHistory {
	titles: Array<{
		titleId: string;
		name: string;
		displayImage: string;
		titleHistory?: {
			lastTimePlayed: string;
		};
		achievement?: {
			currentAchievements: number;
			totalAchievements: number;
			currentGamerscore: number;
			totalGamerscore: number;
		};
	}>;
}

/**
 * Fetch Xbox profile
 * Rate limit: 150 requests/hour
 */
async function fetchXboxProfile(): Promise<XboxProfile | null> {
	const apiKey = process.env.OPENXBL_API_KEY;
	if (!apiKey) {
		return null;
	}

	const response = await fetch(`${OPENXBL_BASE}/account`, {
		headers: {
			"X-Authorization": apiKey,
			Accept: "application/json",
			"Accept-Language": "en-US",
		},
	});

	if (!response.ok) {
		throw new Error(`OpenXBL API error: ${response.status}`);
	}

	return response.json() as Promise<XboxProfile>;
}

/**
 * Fetch recent game history
 */
async function fetchTitleHistory(): Promise<XboxTitleHistory | null> {
	const apiKey = process.env.OPENXBL_API_KEY;
	if (!apiKey) {
		return null;
	}

	const response = await fetch(`${OPENXBL_BASE}/player/titleHistory`, {
		headers: {
			"X-Authorization": apiKey,
			Accept: "application/json",
			"Accept-Language": "en-US",
		},
	});

	if (!response.ok) {
		throw new Error(`OpenXBL API error: ${response.status}`);
	}

	return response.json() as Promise<XboxTitleHistory>;
}

/**
 * Extract setting value from Xbox profile
 */
function getProfileSetting(profile: XboxProfile, settingId: string): string {
	const settings = profile.profileUsers?.[0]?.settings || [];
	return settings.find((s) => s.id === settingId)?.value || "";
}

/**
 * Get Xbox data with caching
 */
export async function getXboxData(): Promise<XboxData> {
	// Try cache first
	const cached = await cacheGet<XboxData>(CACHE_KEYS.GAMING_XBOX);
	if (cached) {
		return cached;
	}

	// Fetch fresh data
	const [profile, titleHistory] = await Promise.all([
		fetchXboxProfile(),
		fetchTitleHistory(),
	]);

	const gamertag = profile
		? getProfileSetting(profile, "Gamertag")
		: "Xbox User";
	const gamerScore = profile
		? Number.parseInt(getProfileSetting(profile, "Gamerscore"), 10) || 0
		: 0;
	const avatarUrl = profile
		? getProfileSetting(profile, "GameDisplayPicRaw")
		: undefined;

	const recentGames: RecentGame[] = (titleHistory?.titles || [])
		.slice(0, 10)
		.map((title) => ({
			platform: "xbox" as const,
			gameId: title.titleId,
			title: title.name,
			imageUrl: title.displayImage,
			lastPlayed: title.titleHistory?.lastTimePlayed,
			achievementsEarned: title.achievement?.currentAchievements,
			achievementsTotal: title.achievement?.totalAchievements,
		}));

	const data: XboxData = {
		gamertag,
		gamerScore,
		avatarUrl,
		recentGames,
		fetchedAt: new Date().toISOString(),
	};

	// Cache for 1 hour
	await cacheSet(CACHE_KEYS.GAMING_XBOX, data, CACHE_TTL.GAMING);

	return data;
}
