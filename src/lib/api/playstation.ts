import {
	type AuthorizationPayload,
	type AuthTokensResponse,
	exchangeAccessCodeForAuthTokens,
	exchangeNpssoForAccessCode,
	exchangeRefreshTokenForAuthTokens,
	getProfileFromAccountId,
	getUserTitles,
	getUserTrophyProfileSummary,
} from "psn-api";
import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGet,
	cacheSet,
	getRedis,
} from "@/lib/cache/redis";
import type { PlayStationData, RecentGame } from "@/types/gaming";

// Token cache (in-memory for the current process)
let cachedAuth: AuthorizationPayload | null = null;
let authExpiresAt = 0;

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
	} catch {
		throw new Error("PSN authentication failed - NPSSO may be expired");
	}

	await redis.set(CACHE_KEYS.PSN_AUTH, {
		refreshToken: authResponse.refreshToken,
		npssoExpiresAt: new Date(Date.now() + NPSSO_LIFETIME_MS).toISOString(),
	} satisfies StoredPsnAuth);
	return remember(authResponse);
}

/**
 * Get PlayStation data with caching
 */
export async function getPlayStationData(): Promise<PlayStationData> {
	// Try cache first
	const cached = await cacheGet<PlayStationData>(CACHE_KEYS.GAMING_PSN);
	if (cached) {
		return cached;
	}

	// Get authentication
	const auth = await getAuth();

	// Fetch trophy summary and recent games first (these accept "me")
	const [trophySummary, titlesResponse] = await Promise.all([
		getUserTrophyProfileSummary(auth, "me"),
		getUserTitles(auth, "me", {
			limit: 10,
			offset: 0,
		}),
	]);

	// Now fetch profile using the real account ID from trophy summary
	let avatarUrl: string | undefined;
	let onlineId = "PSN User";
	try {
		const profile = await getProfileFromAccountId(
			auth,
			trophySummary.accountId,
		);
		avatarUrl = profile.avatars?.[0]?.url;
		onlineId = profile.onlineId;
	} catch {
		// Profile fetch is non-critical, continue without it
	}

	const recentGames: RecentGame[] = (titlesResponse.trophyTitles || []).map(
		(title) => ({
			platform: "playstation" as const,
			gameId: title.npCommunicationId,
			title: title.trophyTitleName,
			imageUrl: title.trophyTitleIconUrl,
			lastPlayed: title.lastUpdatedDateTime,
			achievementsEarned: title.earnedTrophies
				? title.earnedTrophies.bronze +
					title.earnedTrophies.silver +
					title.earnedTrophies.gold +
					title.earnedTrophies.platinum
				: undefined,
			achievementsTotal: title.definedTrophies
				? title.definedTrophies.bronze +
					title.definedTrophies.silver +
					title.definedTrophies.gold +
					title.definedTrophies.platinum
				: undefined,
		}),
	);

	const data: PlayStationData = {
		onlineId,
		accountId: trophySummary.accountId,
		avatarUrl,
		trophyLevel: Number.parseInt(trophySummary.trophyLevel, 10) || 1,
		trophyProgress: trophySummary.progress || 0,
		recentGames,
		fetchedAt: new Date().toISOString(),
	};

	// Cache for 1 hour
	await cacheSet(CACHE_KEYS.GAMING_PSN, data, CACHE_TTL.GAMING);

	return data;
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
