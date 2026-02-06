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
import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { TokenHealth } from "@/lib/db/models/token";
import { connectToDatabase } from "@/lib/db/mongodb";
import type { PlayStationData, RecentGame } from "@/types/gaming";

// Token cache (in-memory for the current process)
let cachedAuth: AuthorizationPayload | null = null;
let authExpiresAt = 0;

/**
 * Get valid PSN authentication
 * Handles token refresh and database storage
 */
async function getAuth(): Promise<AuthorizationPayload> {
	// Check in-memory cache first
	if (cachedAuth && Date.now() < authExpiresAt) {
		return cachedAuth;
	}

	// Try to get stored refresh token from database
	await connectToDatabase();
	const tokenRecord = await TokenHealth.findOne({ service: "psn" });

	if (tokenRecord?.refreshToken) {
		try {
			// Try to use refresh token
			const authResponse: AuthTokensResponse =
				await exchangeRefreshTokenForAuthTokens(tokenRecord.refreshToken);

			// Build the authorization payload (only accessToken is needed for API calls)
			const auth: AuthorizationPayload = {
				accessToken: authResponse.accessToken,
			};

			// Update cached values
			cachedAuth = auth;
			authExpiresAt = Date.now() + (authResponse.expiresIn - 60) * 1000; // 1 minute buffer

			// Update database
			// TODO: Encrypt tokens before storing in database
			// Consider using crypto.createCipheriv with a secret from env vars
			await TokenHealth.updateOne(
				{ service: "psn" },
				{
					$set: {
						status: "healthy",
						lastChecked: new Date(),
						lastSuccess: new Date(),
						accessToken: authResponse.accessToken,
						refreshToken: authResponse.refreshToken,
						accessTokenExpiresAt: new Date(authExpiresAt),
						errorCount: 0,
						errorMessage: undefined,
					},
				},
			);

			return auth;
		} catch (error) {
			console.error("Refresh token failed, falling back to NPSSO:", error);
		}
	}

	// Fall back to NPSSO authentication
	const npsso = process.env.PSN_NPSSO;
	if (!npsso) {
		throw new Error("PSN_NPSSO not configured");
	}

	try {
		const accessCode = await exchangeNpssoForAccessCode(npsso);
		const authResponse: AuthTokensResponse =
			await exchangeAccessCodeForAuthTokens(accessCode);

		// Build the authorization payload
		const auth: AuthorizationPayload = {
			accessToken: authResponse.accessToken,
		};

		// Update cached values
		cachedAuth = auth;
		authExpiresAt = Date.now() + (authResponse.expiresIn - 60) * 1000;

		// Store tokens in database
		// TODO: Encrypt tokens before storing in database
		// Consider using crypto.createCipheriv with a secret from env vars
		await TokenHealth.updateOne(
			{ service: "psn" },
			{
				$set: {
					status: "healthy",
					lastChecked: new Date(),
					lastSuccess: new Date(),
					accessToken: authResponse.accessToken,
					refreshToken: authResponse.refreshToken,
					accessTokenExpiresAt: new Date(authExpiresAt),
					// NPSSO expires in ~2 months
					expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
					errorCount: 0,
					errorMessage: undefined,
				},
			},
			{ upsert: true },
		);

		return auth;
	} catch (error) {
		// Update token health to reflect failure
		await TokenHealth.updateOne(
			{ service: "psn" },
			{
				$set: {
					status: "expired",
					lastChecked: new Date(),
					errorMessage: String(error),
				},
				$inc: { errorCount: 1 },
			},
		);

		throw new Error("PSN authentication failed - NPSSO may be expired");
	}
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

/**
 * Check if PSN token needs refresh
 */
export async function checkPSNTokenHealth(): Promise<{
	status: "healthy" | "expiring_soon" | "expired";
	expiresAt?: Date;
	message?: string;
}> {
	await connectToDatabase();
	const tokenRecord = await TokenHealth.findOne({ service: "psn" });

	if (!tokenRecord) {
		return { status: "expired", message: "No PSN token stored" };
	}

	if (tokenRecord.status === "expired") {
		return {
			status: "expired",
			message: tokenRecord.errorMessage || "Token expired",
		};
	}

	if (tokenRecord.expiresAt) {
		const daysUntilExpiry = Math.floor(
			(tokenRecord.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);

		if (daysUntilExpiry <= 0) {
			return { status: "expired", expiresAt: tokenRecord.expiresAt };
		}

		if (daysUntilExpiry <= 7) {
			return {
				status: "expiring_soon",
				expiresAt: tokenRecord.expiresAt,
				message: `NPSSO expires in ${daysUntilExpiry} days`,
			};
		}
	}

	return {
		status: "healthy",
		expiresAt: tokenRecord.expiresAt || undefined,
	};
}
