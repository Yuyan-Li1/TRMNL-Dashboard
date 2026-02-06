import { EinkIcon } from "@/components/ui/EinkIcon";
import {
	CalendarWidget,
	GamingWidget,
	MedicationWidget,
	RoutineWidget,
	TransitWidget,
	WeatherWidget,
} from "@/components/widgets";
import type { CalendarData } from "@/types/calendar";
import type { GamingData } from "@/types/gaming";
import type { WidgetDisplay } from "@/types/schedule";
import type { TransitData } from "@/types/transport";
import type { WeatherData } from "@/types/weather";

interface WidgetData {
	weather: WeatherData | null;
	transit: TransitData | null;
	calendar: CalendarData | null;
	gaming: GamingData | null;
}

interface RoutineData {
	name: string;
	steps: string[];
}

interface MedicationItem {
	name: string;
	dosage?: string;
	time?: string;
	notes?: string;
}

/**
 * Render a single widget based on its type and configuration
 */
export function renderWidget(
	widget: WidgetDisplay,
	data: WidgetData,
	routine: RoutineData | null,
	medications: MedicationItem[],
	opts?: { mergedMedication?: boolean },
): React.JSX.Element | null {
	const size = widget.size;

	switch (widget.type) {
		case "weather":
			return (
				<WeatherWidget
					key="weather"
					data={data.weather}
					size={size as "small" | "medium" | "large"}
					showForecast={size !== "small"}
				/>
			);

		case "transit":
			return (
				<TransitWidget
					key="transit"
					data={data.transit}
					size={size as "small" | "medium" | "large"}
				/>
			);

		case "calendar":
			return (
				<CalendarWidget
					key="calendar"
					data={data.calendar}
					size={size as "small" | "medium" | "large"}
					mode={size === "large" ? "today" : "upcoming"}
				/>
			);

		case "gaming":
			return (
				<GamingWidget
					key="gaming"
					data={data.gaming}
					size={size as "small" | "medium" | "large"}
					limit={size === "large" ? 5 : 4}
				/>
			);

		case "routine": {
			const category = (widget.config?.category as string) || "custom";
			const routineEl = (
				<RoutineWidget
					key={`routine-${category}`}
					name={routine?.name ?? "Routine"}
					steps={routine?.steps.map((step) => ({ title: step })) ?? []}
					size={size as "small" | "medium" | "large"}
					category={
						category as
							| "morning"
							| "evening"
							| "skincare"
							| "medication"
							| "custom"
					}
				/>
			);

			// When medication is merged into this cell, render a compact
			// medication strip above the routine card
			if (opts?.mergedMedication && medications.length > 0) {
				return (
					<div
						key="routine-medication"
						className="flex flex-col gap-2 h-full"
					>
						<div className="border-2 border-eink-black px-3 py-2 flex items-center justify-between shrink-0">
							<div className="flex items-center gap-2">
								<EinkIcon name="pill" size="sm" />
								{medications.map((m) => (
									<span
										key={m.name}
										className="text-eink-sm font-medium"
									>
										{m.name}
									</span>
								))}
							</div>
							{medications[0]?.time && (
								<span className="text-eink-sm font-bold">
									{medications[0].time}
								</span>
							)}
						</div>
						<div className="flex-1 min-h-0">{routineEl}</div>
					</div>
				);
			}

			return routineEl;
		}

		case "medication":
			return (
				<MedicationWidget
					key="medication"
					medications={
						medications.length > 0
							? medications.map((m) => ({
									name: m.name,
									dosage: m.dosage,
									time: m.time,
								}))
							: [{ name: "No medications configured" }]
					}
					size={size === "large" ? "medium" : "small"}
				/>
			);

		default:
			return null;
	}
}

export interface RenderedWidget {
	config: WidgetDisplay;
	element: React.JSX.Element;
}

/**
 * Get the effective widget list after merging (e.g. medication into routine).
 * Use this for layout calculation so slots match rendered output.
 */
export function getEffectiveWidgets(widgets: WidgetDisplay[]): WidgetDisplay[] {
	const hasRoutine = widgets.some((w) => w.type === "routine");
	const hasMedication = widgets.some((w) => w.type === "medication");
	if (hasRoutine && hasMedication) {
		return widgets.filter((w) => w.type !== "medication");
	}
	return widgets;
}

/**
 * Render all widgets for the dashboard, paired with their config.
 * When both routine and medication are present, merges medication
 * into the routine cell to save a grid slot.
 */
export function renderWidgets(
	widgets: WidgetDisplay[],
	data: WidgetData,
	routine: RoutineData | null,
	medications: MedicationItem[],
): RenderedWidget[] {
	const effective = getEffectiveWidgets(widgets);
	const mergeMedIntoRoutine = effective.length < widgets.length;

	return effective
		.map((widget) => {
			const element = renderWidget(widget, data, routine, medications, {
				mergedMedication:
					widget.type === "routine" && mergeMedIntoRoutine,
			});
			return element ? { config: widget, element } : null;
		})
		.filter((entry): entry is RenderedWidget => entry !== null);
}
