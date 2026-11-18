import { type NextRequest, NextResponse } from "next/server";
import { runDaily } from "@/lib/api/daily";

/** Paging PSN to the end takes longer than the default allows. */
export const maxDuration = 60;

/**
 * POST /api/daily
 * The daily run: each source's full history.
 * Called by GitHub Actions once a day, on its own schedule.
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		console.error("CRON_SECRET not configured");
		return NextResponse.json(
			{ error: "Server misconfigured" },
			{ status: 500 },
		);
	}
	if (request.headers.get("Authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const result = await runDaily();
		const duration = `${Date.now() - startTime}ms`;
		console.log(
			[
				`Daily run completed in ${duration}`,
				...result.errors.map((error) => `  ${error}`),
			].join("\n"),
		);
		return NextResponse.json(
			{ success: result.errors.length === 0, duration, ...result },
			// 207 = Multi-Status (partial success)
			{ status: result.errors.length > 0 ? 207 : 200 },
		);
	} catch (error) {
		console.error("Daily run failed:", error);
		return NextResponse.json(
			{
				error: "Daily run failed",
				details: String(error),
				duration: `${Date.now() - startTime}ms`,
			},
			{ status: 500 },
		);
	}
}
