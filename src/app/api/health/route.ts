import { NextResponse } from "next/server";
import { getRedis } from "@/lib/cache/redis";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET() {
	const health = {
		mongodb: false,
		redis: false,
		apis: {
			weather: false,
			transit: false,
			calendar: false,
		},
		timestamp: new Date().toISOString(),
	};

	// Test MongoDB
	try {
		const m = await connectToDatabase();
		health.mongodb = m.connection.readyState === 1;
	} catch (error) {
		console.error("MongoDB health check failed:", error);
	}

	// Test Redis
	try {
		const redis = getRedis();
		await redis.ping();
		health.redis = true;
	} catch (error) {
		console.error("Redis health check failed:", error);
	}

	// Check API configuration (not actual calls to avoid rate limits)
	health.apis.weather = true; // Open-Meteo has no auth
	health.apis.transit = !!process.env.TFNSW_API_KEY;
	health.apis.calendar = !!(
		process.env.GOOGLE_CLIENT_EMAIL &&
		process.env.GOOGLE_PRIVATE_KEY &&
		process.env.GOOGLE_CALENDAR_ID
	);

	const allHealthy = health.mongodb && health.redis;
	const allApisConfigured = Object.values(health.apis).every(Boolean);

	return NextResponse.json(health, {
		status: allHealthy ? (allApisConfigured ? 200 : 206) : 503,
	});
}
