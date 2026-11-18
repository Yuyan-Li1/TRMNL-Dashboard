import { Redis } from "@upstash/redis";

// Singleton pattern for Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
	if (!redis) {
		const url = process.env.UPSTASH_REDIS_REST_URL;
		const token = process.env.UPSTASH_REDIS_REST_TOKEN;

		if (!url || !token) {
			throw new Error("Missing Upstash Redis environment variables");
		}

		redis = new Redis({ url, token });
	}

	return redis;
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
	GAMING: 60 * 60, // 1 hour
	MOVIES: 60 * 60, // 1 hour
	DASHBOARD_DATA: 15 * 60, // 15 minutes
	/** How long a TMDB lookup is reused before TMDB is asked again */
	TMDB_LOOKUP: 30 * 24 * 60 * 60, // 30 days
	/**
	 * The longest anything made from a TMDB lookup is kept: a poster, or the
	 * non-expiring copy of data that holds TMDB's text. With the lookup's own
	 * 30 days this keeps TMDB data under the 6 months its terms allow.
	 */
	TMDB_DERIVED: 150 * 24 * 60 * 60, // 150 days
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
	GAMING_STEAM: "plays:steam",
	GAMING_XBOX: "plays:xbox",
	GAMING_PSN: "plays:psn",
	GAMING_SWITCH: "plays:switch",
	MOVIES_LETTERBOXD: "diary:letterboxd",
	IGDB_TOKEN: "igdb:token",
	PSN_AUTH: "psn:auth",
	DASHBOARD_DATA: "dashboard:media",
	SPOTLIGHT_PREVIOUS: "spotlight:previous",
} as const;

/**
 * Generic cache get with JSON parsing
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	const r = getRedis();
	const data = await r.get<T>(key);
	return data;
}

/**
 * The non-expiring copy `cacheSet` keeps beside a key: stale but never
 * missing.
 */
export async function cacheGetLatest<T>(key: string): Promise<T | null> {
	return cacheGet<T>(`${key}:latest`);
}

/** The fresh value, or the non-expiring copy once the TTL'd key has expired. */
export async function cacheGetOrLatest<T>(key: string): Promise<T | null> {
	return (await cacheGet<T>(key)) ?? (await cacheGetLatest<T>(key));
}

/**
 * Generic cache set with TTL
 * Also stores a copy at `${key}:latest` so data is never lost. The copy does
 * not expire unless `latestTtlSeconds` is given, which is for data that may
 * not be kept for ever.
 */
export async function cacheSet<T>(
	key: string,
	data: T,
	ttlSeconds: number,
	latestTtlSeconds?: number,
): Promise<void> {
	const r = getRedis();
	await Promise.all([
		r.setex(key, ttlSeconds, data),
		latestTtlSeconds === undefined
			? r.set(`${key}:latest`, data)
			: r.setex(`${key}:latest`, latestTtlSeconds, data),
	]);
}

/**
 * Delete a cache key
 */
export async function cacheDelete(key: string): Promise<void> {
	const r = getRedis();
	await r.del(key);
}

/**
 * Check if key exists and get TTL
 */
export async function cacheTTL(key: string): Promise<number> {
	const r = getRedis();
	return r.ttl(key);
}
