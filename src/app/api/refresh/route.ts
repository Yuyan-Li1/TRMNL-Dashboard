import { type NextRequest, NextResponse } from "next/server";
import { refreshCoreData } from "@/lib/api/refresh";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/refresh
 * Triggers a refresh of all cached data
 * Called by GitHub Actions every 15 minutes
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();

	// Verify authorization
	const authHeader = request.headers.get("Authorization");
	const userAgent = request.headers.get("User-Agent") || "";

	if (!CRON_SECRET) {
		console.error("CRON_SECRET not configured");
		return NextResponse.json(
			{ error: "Server misconfigured" },
			{ status: 500 },
		);
	}

	// Check authorization
	if (authHeader !== `Bearer ${CRON_SECRET}`) {
		console.warn("Unauthorized refresh attempt", {
			userAgent,
			authProvided: !!authHeader,
		});
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		console.log("Starting data refresh...", {
			userAgent,
			timestamp: new Date().toISOString(),
		});

		const data = await refreshCoreData();
		const duration = Date.now() - startTime;

		const hasErrors = data.errors.length > 0;

		const gamingCount = data.gaming?.allRecentGames.length ?? 0;
		console.log(
			[
				`Refresh completed in ${duration}ms`,
				`  Weather:  ${data.weather ? "OK" : "FAILED"}`,
				`  Transit:  ${data.transit ? "OK" : "FAILED"}`,
				`  Calendar: ${data.calendar ? "OK" : "FAILED"}`,
				`  Gaming:   ${data.gaming ? `OK (${gamingCount} games)` : "FAILED"}`,
				...(data.errors.length > 0
					? [`  Errors: ${data.errors.join(", ")}`]
					: []),
			].join("\n"),
		);

		return NextResponse.json(
			{
				success: !hasErrors,
				refreshedAt: data.refreshedAt,
				duration: `${duration}ms`,
				errors: data.errors,
				summary: {
					weather: data.weather ? "OK" : "FAILED",
					transit: data.transit ? "OK" : "FAILED",
					calendar: data.calendar ? "OK" : "FAILED",
					gaming: data.gaming ? `OK (${gamingCount} games)` : "FAILED",
				},
			},
			{
				status: hasErrors ? 207 : 200, // 207 = Multi-Status (partial success)
			},
		);
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error("Refresh failed:", error);

		return NextResponse.json(
			{
				error: "Refresh failed",
				details: String(error),
				duration: `${duration}ms`,
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/refresh
 * Health check for the refresh endpoint
 */
export async function GET() {
	return NextResponse.json({
		status: "ready",
		endpoint: "/api/refresh",
		method: "POST",
		requiresAuth: true,
		cronConfigured: !!CRON_SECRET,
	});
}
