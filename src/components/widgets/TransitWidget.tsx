import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";
import { LOCATION } from "@/lib/config";
import type { CommuteJourney, TransitData } from "@/types/transport";

interface TransitWidgetProps {
	data: TransitData | null;
	size?: "small" | "medium" | "large";
}

/** Short station name: "Bondi Junction" → "Bondi Jct" */
function shortName(name: string): string {
	return name.replace("Junction", "Jct");
}

/** Format departure time as HH:mm */
function fmtTime(iso: string): string {
	return new Date(iso).toLocaleTimeString("en-AU", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: LOCATION.timezone,
	});
}

/** Summarise lines across legs: ["T2","T4"] → "T2 → T4", single leg → "T4 direct" */
function linesSummary(journey: CommuteJourney): string {
	const lines = journey.legs.map((l) => l.line);
	if (lines.length === 1) return `${lines[0]} direct`;
	return lines.join(" → ");
}

/** Check if the transit data has major disruptions worth highlighting */
function hasMajorDisruptions(data: TransitData): boolean {
	return data.journeys.some(
		(j) => j.status === "cancelled" || j.delayMinutes >= 10,
	);
}

export function TransitWidget({ data, size = "medium" }: TransitWidgetProps) {
	if (!data) {
		return (
			<EinkCard
				title="Commute"
				icon={<EinkIcon name="train" size="sm" />}
				size={size}
			>
				<div className="flex items-center justify-center h-full text-eink-dark">
					No commute data
				</div>
			</EinkCard>
		);
	}

	const hasDisruptions = hasMajorDisruptions(data);
	const title = `${shortName(data.origin)} → ${shortName(data.destination)}`;

	return (
		<EinkCard
			title={title}
			icon={<EinkIcon name="train" size="sm" />}
			size={size}
			variant={hasDisruptions ? "filled" : "default"}
		>
			<div className="flex flex-col gap-1">
				{/* Disruption banner when delays ≥ 10 min or cancellations */}
				{hasDisruptions && (
					<div className="bg-eink-black text-eink-white px-2 py-1 text-eink-xs font-bold mb-1">
						{data.journeys.some((j) => j.status === "cancelled")
							? "CANCELLATIONS — check alternatives"
							: "MAJOR DELAYS — expect disruptions"}
					</div>
				)}

				{data.journeys.length === 0 ? (
					<div className="text-eink-dark text-eink-sm">No journeys found</div>
				) : (
					data.journeys.map((journey, i) => (
						<JourneyRow
							key={`${journey.departureTime}-${i}`}
							journey={journey}
							isLast={i === data.journeys.length - 1}
						/>
					))
				)}
			</div>
		</EinkCard>
	);
}

function JourneyRow({
	journey,
	isLast,
}: {
	journey: CommuteJourney;
	isLast: boolean;
}) {
	const isCancelled = journey.status === "cancelled";
	const isDelayed = journey.status === "delayed";
	const depTime = journey.departureTime
		? fmtTime(journey.departureTime)
		: "--:--";
	const lines = linesSummary(journey);
	const duration = `${journey.totalDurationMinutes} min`;

	return (
		<div
			className={`
				flex items-center justify-between py-1
				${!isLast ? "border-b border-eink-light" : ""}
				${isCancelled ? "opacity-60" : ""}
			`}
		>
			<div className="flex items-center gap-2">
				{/* Departure time */}
				<span
					className={`text-eink-lg font-bold ${isCancelled ? "line-through" : ""}`}
				>
					{depTime}
				</span>
				{/* Lines used */}
				<span className="text-eink-sm">{lines}</span>
			</div>

			<div className="flex items-center gap-2">
				{/* Duration */}
				<span className="text-eink-sm">{duration}</span>

				{/* Status badges */}
				{isCancelled && (
					<span className="text-eink-xs bg-eink-black text-eink-white px-1 font-bold">
						CANC
					</span>
				)}
				{isDelayed && journey.delayMinutes > 0 && (
					<span className="text-eink-xs border-2 border-eink-black px-1 font-bold">
						+{journey.delayMinutes}
					</span>
				)}
			</div>
		</div>
	);
}
