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
	WEATHER: 15 * 60, // 15 minutes
	TRANSIT: 5 * 60, // 5 minutes
	CALENDAR: 10 * 60, // 10 minutes
	GAMING: 60 * 60, // 1 hour
	TOKEN_HEALTH: 5 * 60, // 5 minutes
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
	WEATHER: "weather:sydney",
	TRANSIT: "transit:commute",
	CALENDAR: "calendar:events",
	GAMING_STEAM: "gaming:steam",
	GAMING_XBOX: "gaming:xbox",
	GAMING_PSN: "gaming:psn",
	TOKEN_HEALTH: "tokens:health",
	DASHBOARD_DATA: "dashboard:data",
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
 * Generic cache set with TTL
 * Also stores a non-expiring copy at `${key}:latest` so data is never lost
 */
export async function cacheSet<T>(
	key: string,
	data: T,
	ttlSeconds: number,
): Promise<void> {
	const r = getRedis();
	await Promise.all([
		r.setex(key, ttlSeconds, data),
		r.set(`${key}:latest`, data),
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
