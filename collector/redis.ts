import { Redis } from "@upstash/redis";

/** The little of Redis the Collector uses, so a test can stand in for it. */
export interface HomeRedis {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown): Promise<void>;
	del(key: string): Promise<void>;
}

/** Upstash, with the same credentials Vercel uses. */
export function connectRedis(url: string, token: string): HomeRedis {
	// One try each: a tick that cannot reach Redis alerts and moves on
	const redis = new Redis({ url, token, retry: { retries: 1 } });
	return {
		get: <T>(key: string) => redis.get<T>(key),
		set: async (key, value) => {
			await redis.set(key, value);
		},
		del: async (key) => {
			await redis.del(key);
		},
	};
}
