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
					limit={size === "large" ? 6 : 4}
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
					limit={size === "large" ? 5 : 3}
				/>
			);

		case "routine": {
			if (!routine) return null;
			const category = (widget.config?.category as string) || "custom";
			return (
				<RoutineWidget
					key={`routine-${category}`}
					name={routine.name}
					steps={routine.steps.map((step) => ({ title: step }))}
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

/**
 * Render all widgets for the dashboard
 */
export function renderWidgets(
	widgets: WidgetDisplay[],
	data: WidgetData,
	routine: RoutineData | null,
	medications: MedicationItem[],
): React.JSX.Element[] {
	return widgets
		.map((widget) => renderWidget(widget, data, routine, medications))
		.filter((element): element is React.JSX.Element => element !== null);
}
