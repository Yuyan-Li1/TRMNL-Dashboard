import { NextResponse } from "next/server";
import { getScheduleContext } from "@/lib/schedule/context";
import { getActiveRoutine, getWidgetsForContext } from "@/lib/schedule/widgets";

/**
 * GET /api/schedule
 * Returns current schedule context and widgets to display
 */
export async function GET() {
	try {
		// Get current context
		const context = await getScheduleContext();

		// Get widgets for this context
		const widgets = await getWidgetsForContext(context);

		// Get active routine if any
		const routine = await getActiveRoutine(context);

		return NextResponse.json({
			context,
			widgets,
			routine,
			debug: {
				timestamp: new Date().toISOString(),
				widgetCount: widgets.length,
				hasRoutine: !!routine,
				conditionCount: context.specialConditions.length,
			},
		});
	} catch (error) {
		console.error("Schedule API error:", error);
		return NextResponse.json(
			{ error: "Failed to get schedule", details: String(error) },
			{ status: 500 },
		);
	}
}
