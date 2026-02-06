/**
 * Validate that required environment variables are set.
 * Call this in API routes / server components to fail fast
 * with a clear message instead of cryptic runtime errors.
 */
export function validateEnv(required: string[]): Record<string, string> {
	const missing: string[] = [];
	const values: Record<string, string> = {};

	for (const key of required) {
		const value = process.env[key];
		if (!value) {
			missing.push(key);
		} else {
			values[key] = value;
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}

	return values;
}

// Pre-defined groups for common checks
export const ENV_GROUPS = {
	database: ["MONGODB_URI"],
	cache: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
	transit: ["TFNSW_API_KEY"],
	steam: ["STEAM_API_KEY", "STEAM_ID"],
	xbox: ["OPENXBL_API_KEY"],
	psn: ["PSN_NPSSO"],
	google: ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_CALENDAR_ID"],
	cron: ["CRON_SECRET"],
} as const;
