import { Routine } from "@/lib/db/models/routine";
import { Schedule } from "@/lib/db/models/schedule";
import { connectToDatabase } from "@/lib/db/mongodb";
import type { DayType, TimeBlock, WidgetType } from "@/types";
import type {
	ScheduleContext,
	SpecialCondition,
	WidgetDisplay,
} from "@/types/schedule";

// Default widget configurations by context
const DEFAULT_WIDGETS: Record<DayType, Record<TimeBlock, WidgetDisplay[]>> = {
	office: {
		morning: [
			{
				type: "routine",
				priority: 1,
				size: "medium",
				config: { category: "morning" },
			},
			{ type: "weather", priority: 2, size: "medium" },
			{ type: "transit", priority: 3, size: "medium" },
		],
		workday: [
			{ type: "calendar", priority: 1, size: "large" },
			{ type: "weather", priority: 2, size: "small" },
		],
		evening: [
			{
				type: "routine",
				priority: 1,
				size: "medium",
				config: { category: "skincare" },
			},
			{ type: "weather", priority: 2, size: "small" },
		],
		night: [{ type: "weather", priority: 1, size: "medium" }],
	},
	wfh: {
		morning: [
			{ type: "weather", priority: 1, size: "medium" },
			{ type: "calendar", priority: 2, size: "medium" },
		],
		workday: [
			{ type: "medication", priority: 1, size: "small" },
			{ type: "calendar", priority: 2, size: "large" },
		],
		evening: [
			{
				type: "routine",
				priority: 1,
				size: "medium",
				config: { category: "skincare" },
			},
			{ type: "gaming", priority: 2, size: "medium" },
		],
		night: [{ type: "weather", priority: 1, size: "medium" }],
	},
	weekend: {
		morning: [
			{ type: "weather", priority: 1, size: "medium" },
			{ type: "gaming", priority: 2, size: "large" },
		],
		workday: [
			{ type: "weather", priority: 1, size: "small" },
			{ type: "gaming", priority: 2, size: "large" },
		],
		evening: [
			{ type: "gaming", priority: 1, size: "large" },
			{
				type: "routine",
				priority: 2,
				size: "medium",
				config: { category: "skincare" },
			},
		],
		night: [{ type: "weather", priority: 1, size: "medium" }],
	},
};

/**
 * Get widgets to display for current context
 */
export async function getWidgetsForContext(
	context: ScheduleContext,
): Promise<WidgetDisplay[]> {
	let widgets: WidgetDisplay[] = [];

	try {
		await connectToDatabase();

		// Try to get from database first
		const schedule = await Schedule.findOne({
			daysOfWeek: context.dayOfWeek,
			isActive: true,
		});

		if (schedule) {
			const timeBlock = schedule.timeBlocks.find(
				(tb) => tb.name === context.timeBlock,
			);

			if (timeBlock?.widgets) {
				widgets = timeBlock.widgets
					.filter((w) => w.enabled)
					.map((w) => ({
						type: w.type,
						priority: w.priority,
						size: getSizeForWidget(w.type, w.priority),
						config: w.config,
					}));
			}
		}
	} catch (error) {
		console.error("Error fetching schedule from database:", error);
	}

	// Fall back to defaults if no database config
	if (widgets.length === 0) {
		widgets = DEFAULT_WIDGETS[context.dayType][context.timeBlock] || [];
	}

	// Apply special condition modifications
	widgets = applySpecialConditions(widgets, context.specialConditions);

	// Sort by priority
	return widgets.sort((a, b) => a.priority - b.priority);
}

/**
 * Determine widget size based on type and priority
 */
function getSizeForWidget(
	type: WidgetType,
	priority: number,
): WidgetDisplay["size"] {
	// Primary widget (priority 1) gets more space
	if (priority === 1) {
		return type === "gaming" || type === "calendar" ? "large" : "medium";
	}

	// Secondary widgets
	if (priority === 2) {
		return "medium";
	}

	// Tertiary and below
	return "small";
}

/**
 * Modify widget list based on special conditions
 */
function applySpecialConditions(
	widgets: WidgetDisplay[],
	conditions: SpecialCondition[],
): WidgetDisplay[] {
	const modified = [...widgets];

	for (const condition of conditions) {
		switch (condition.type) {
			case "rain_expected": {
				// Ensure weather widget is present and visible
				const weatherIdx = modified.findIndex((w) => w.type === "weather");
				if (weatherIdx >= 0) {
					modified[weatherIdx].priority = 1; // Bump to top
					modified[weatherIdx].size = "medium";
				} else {
					modified.unshift({
						type: "weather",
						priority: 1,
						size: "medium",
					});
				}
				break;
			}

			case "train_delay": {
				// Ensure transit widget is prominent
				const transitIdx = modified.findIndex((w) => w.type === "transit");
				if (transitIdx >= 0) {
					modified[transitIdx].priority = 1;
					modified[transitIdx].size = "large";
				} else {
					modified.unshift({
						type: "transit",
						priority: 1,
						size: "large",
					});
				}
				break;
			}

			case "meeting_soon": {
				// Ensure calendar is visible
				const calIdx = modified.findIndex((w) => w.type === "calendar");
				if (calIdx >= 0) {
					modified[calIdx].priority = Math.min(modified[calIdx].priority, 2);
				}
				break;
			}
		}
	}

	// Re-sort after modifications
	return modified.sort((a, b) => a.priority - b.priority);
}

/**
 * Get routine to display (if any) for current context
 */
export async function getActiveRoutine(
	context: ScheduleContext,
): Promise<{ name: string; steps: string[] } | null> {
	try {
		await connectToDatabase();

		// Find matching routine
		const routine = await Routine.findOne({
			isActive: true,
			$or: [
				{ "recurrence.type": "daily" },
				{ "recurrence.daysOfWeek": context.dayOfWeek },
			],
			"timeWindow.startTime": { $lte: context.time },
			"timeWindow.endTime": { $gte: context.time },
		});

		if (!routine) {
			return null;
		}

		return {
			name: routine.name,
			steps: routine.steps
				.filter((s) => !s.isOptional)
				.sort((a, b) => a.order - b.order)
				.map((s) => s.title),
		};
	} catch (error) {
		console.error("Error fetching routine:", error);
		return null;
	}
}

/**
 * Get medication routines for the current context
 */
export async function getMedicationRoutines(
	context: ScheduleContext,
): Promise<
	Array<{ name: string; dosage?: string; time?: string; notes?: string }>
> {
	try {
		await connectToDatabase();

		const routines = await Routine.find({
			category: "medication",
			isActive: true,
			$or: [
				{ "recurrence.type": "daily" },
				{ "recurrence.daysOfWeek": context.dayOfWeek },
			],
		});

		return routines.flatMap((routine) =>
			routine.steps
				.sort((a, b) => a.order - b.order)
				.map((step) => ({
					name: step.title,
					dosage: undefined,
					time: routine.timeWindow.startTime,
					notes: step.isOptional ? "optional" : undefined,
				})),
		);
	} catch (error) {
		console.error("Error fetching medication routines:", error);
		return [];
	}
}

/**
 * Check if a specific widget should be shown
 */
export function shouldShowWidget(
	type: WidgetType,
	widgets: WidgetDisplay[],
): boolean {
	return widgets.some((w) => w.type === type);
}

/**
 * Get config for a specific widget
 */
export function getWidgetConfig(
	type: WidgetType,
	widgets: WidgetDisplay[],
): Record<string, unknown> | undefined {
	const widget = widgets.find((w) => w.type === type);
	return widget?.config;
}
