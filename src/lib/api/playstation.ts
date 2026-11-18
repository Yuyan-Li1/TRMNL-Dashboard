import {
	type AuthorizationPayload,
	type AuthTokensResponse,
	exchangeAccessCodeForAuthTokens,
	exchangeNpssoForAccessCode,
	exchangeRefreshTokenForAuthTokens,
	getUserPlayedGames,
} from "psn-api";
import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGet,
	cacheSet,
	getRedis,
} from "@/lib/cache/redis";
import { TokenRejectedError, trackRead } from "@/lib/health/reads";
import type { PlatformPlay } from "@/types/gaming";

// Token cache (in-memory for the current process)
let cachedAuth: AuthorizationPayload | null = null;
let authExpiresAt = 0;

/** Most recently played first, so the first page holds everything recent. */
const PLAYED_GAMES_LIMIT = 100;

const NPSSO_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

interface StoredPsnAuth {
	refreshToken: string;
	/** When the NPSSO in `PSN_NPSSO` is expected to stop working. */
	npssoExpiresAt?: string;
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
		npssoExpiresAt: new Date(Date.now() + NPSSO_LIFETIME_MS).toISOString(),
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
			// The rest are apps such as Netflix and Plex
			.filter((title) => title.category?.includes("game"))
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

export interface PsnTokenHealth {
	status: "healthy" | "expiring_soon" | "expired";
	expiresAt?: string;
	message?: string;
}

/**
 * Live check of the PSN token: authenticate now and report the result.
 */
export async function checkPSNTokenHealth(): Promise<PsnTokenHealth> {
	try {
		await getAuth();
	} catch (error) {
		return { status: "expired", message: String(error) };
	}

	const stored = await getRedis().get<StoredPsnAuth>(CACHE_KEYS.PSN_AUTH);
	const expiresAt = stored?.npssoExpiresAt;
	if (expiresAt) {
		const daysUntilExpiry = Math.floor(
			(new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);
		if (daysUntilExpiry <= 7) {
			return {
				status: "expiring_soon",
				expiresAt,
				message: `NPSSO expires in ${daysUntilExpiry} days`,
			};
		}
	}

	return { status: "healthy", expiresAt };
}
