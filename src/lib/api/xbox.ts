import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import type { PlatformPlay } from "@/types/gaming";

const OPENXBL_BASE = "https://xbl.io/api/v2";

interface XboxTitle {
	titleId: string;
	name: string;
	/** "Game" for games; apps carry other values */
	type?: string;
	displayImage?: string;
	titleHistory?: {
		lastTimePlayed?: string;
	};
}

/** OpenXBL wraps the title history as `{ content: { titles }, code }`. */
interface XboxTitleHistoryResponse {
	content?: {
		titles?: XboxTitle[];
	};
	code?: number;
}

/**
 * Every Xbox title the owner has played, with last played date. Xbox does
 * not report play time. Cached for an hour.
 * Rate limit: 150 requests/hour
 */
export async function getXboxPlays(): Promise<PlatformPlay[]> {
	const cached = await cacheGet<PlatformPlay[]>(CACHE_KEYS.GAMING_XBOX);
	if (cached) {
		return cached;
	}

	const apiKey = process.env.OPENXBL_API_KEY;
	if (!apiKey) {
		throw new Error("OPENXBL_API_KEY not configured");
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

	const body = (await response.json()) as XboxTitleHistoryResponse;
	const titles = body.content?.titles;
	if (!titles) {
		throw new Error("OpenXBL returned no title history");
	}

	const plays: PlatformPlay[] = titles
		.filter((title) => !title.type || title.type === "Game")
		.map((title) => ({
			platform: "xbox" as const,
			name: title.name,
			lastPlayedAt: title.titleHistory?.lastTimePlayed,
			imageUrl: title.displayImage,
		}));

	await cacheSet(CACHE_KEYS.GAMING_XBOX, plays, CACHE_TTL.GAMING);
	return plays;
}
