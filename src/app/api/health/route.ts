import { NextResponse } from "next/server";
import { getRedis } from "@/lib/cache/redis";

export async function GET(): Promise<NextResponse> {
	const health = {
		redis: false,
		timestamp: new Date().toISOString(),
	};

	try {
		await getRedis().ping();
		health.redis = true;
	} catch (error) {
		console.error("Redis health check failed:", error);
	}

	return NextResponse.json(health, { status: health.redis ? 200 : 503 });
}
