import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { TokenRejectedError, trackRead } from "@/lib/health/reads";
import type { Platform, PlatformPlay } from "@/types/gaming";

/**
 * Nintendo Switch play history, from the unofficial Play Activity API of the
 * Nintendo Switch app. The session token lasts about two years; access
 * tokens derived from it last 15 minutes.
 */
const ACCOUNTS_URL = "https://accounts.nintendo.com";
const APP_URL = "https://app-api.znej.nintendo.com";
const CLIENT_ID = "5c38e31cd085304b";
// Nintendo's gateway rejects requests that do not identify as its own app
const USER_AGENT = "com.nintendo.znej/3.0.3 (iOS/26.0.1)";
// en-US first (the account is US-region); en-GB is known to work; en-AU is
// answered with 400.
const LOCALES = ["en-US", "en-GB"] as const;

interface NintendoToken {
	access_token?: string;
}

interface NintendoTitle {
	titleName: string;
	/** `BEE` is Switch 2, `HAC` the original Switch */
	platform?: string;
	imageUrl?: string;
	lastPlayedAt?: string;
	totalPlayedMinutes?: number;
}

interface NintendoPlayHistory {
	playHistories?: NintendoTitle[];
}

async function getAccessToken(sessionToken: string): Promise<string> {
	const response = await fetch(`${ACCOUNTS_URL}/connect/1.0.0/api/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			Accept: "application/json",
			"User-Agent": USER_AGENT,
		},
		body: JSON.stringify({
			client_id: CLIENT_ID,
			session_token: sessionToken,
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer-session-token",
		}),
	});
	// Nintendo answers a session token it no longer accepts with 400 or 401
	if (response.status === 400 || response.status === 401) {
		throw new TokenRejectedError(
			`Nintendo rejected the session token: ${response.status}`,
		);
	}
	if (!response.ok) {
		throw new Error(`Nintendo token exchange failed: ${response.status}`);
	}
	const token = (await response.json()) as NintendoToken;
	if (!token.access_token) {
		throw new Error("Nintendo returned no access token");
	}
	return token.access_token;
}

async function fetchPlayHistory(
	accessToken: string,
): Promise<NintendoPlayHistory> {
	let lastStatus = 0;
	for (const locale of LOCALES) {
		const response = await fetch(
			`${APP_URL}/api/v2.0/users/me/play_histories`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/json",
					"User-Agent": USER_AGENT,
					"Gentry-Locale": locale,
				},
			},
		);
		if (response.ok) {
			return (await response.json()) as NintendoPlayHistory;
		}
		lastStatus = response.status;
		// Only a rejected locale (400) is worth trying the next one for
		if (response.status !== 400) break;
	}
	throw new Error(`Nintendo play history failed: ${lastStatus}`);
}

function toPlatform(code: string | undefined): Platform {
	return code === "BEE" ? "switch2" : "switch";
}

/**
 * Every Switch and Switch 2 title the owner has played. Nintendo updates the
 * data once a day, so it is fetched at most hourly.
 */
export async function getSwitchPlays(): Promise<PlatformPlay[]> {
	const cached = await cacheGet<PlatformPlay[]>(CACHE_KEYS.GAMING_SWITCH);
	if (cached) {
		return cached;
	}

	return trackRead("switch", async () => {
		const sessionToken = process.env.NINTENDO_SESSION_TOKEN;
		if (!sessionToken) {
			throw new Error("NINTENDO_SESSION_TOKEN not configured");
		}

		const history = await fetchPlayHistory(await getAccessToken(sessionToken));

		const plays: PlatformPlay[] = (history.playHistories ?? []).map(
			(title) => ({
				platform: toPlatform(title.platform),
				name: title.titleName,
				lastPlayedAt: title.lastPlayedAt,
				minutesPlayed: title.totalPlayedMinutes,
				imageUrl: title.imageUrl,
			}),
		);

		await cacheSet(CACHE_KEYS.GAMING_SWITCH, plays, CACHE_TTL.GAMING);
		return plays;
	});
}
