import { NextResponse } from "next/server";
import { refreshCoreData } from "@/lib/api/refresh";

/**
 * POST /api/admin/refresh
 * Manual data refresh triggered from the admin UI
 */
export async function POST() {
	const startTime = Date.now();

	try {
		const data = await refreshCoreData();
		const duration = Date.now() - startTime;

		return NextResponse.json({
			success: data.errors.length === 0,
			refreshedAt: data.refreshedAt,
			duration: `${duration}ms`,
			errors: data.errors,
			summary: {
				weather: data.weather ? "OK" : "FAILED",
				transit: data.transit ? "OK" : "FAILED",
				calendar: data.calendar ? "OK" : "FAILED",
				gaming: data.gaming ? "OK" : "FAILED",
			},
		});
	} catch (error) {
		const duration = Date.now() - startTime;
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
