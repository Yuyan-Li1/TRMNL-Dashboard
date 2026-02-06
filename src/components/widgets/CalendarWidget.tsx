import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";
import { getTodayEvents, getUpcomingEvents } from "@/lib/api/calendar";
import { LOCATION } from "@/lib/config";
import type { CalendarData, CalendarEvent } from "@/types/calendar";

interface CalendarWidgetProps {
	data: CalendarData | null;
	size?: "small" | "medium" | "large";
	mode?: "today" | "upcoming";
}

export function CalendarWidget({
	data,
	size = "medium",
	mode = "today",
}: CalendarWidgetProps) {
	if (!data) {
		return (
			<EinkCard
				title="Calendar"
				icon={<EinkIcon name="calendar" size="sm" />}
				size={size}
			>
				<div className="flex items-center justify-center h-full text-eink-dark">
					No calendar data
				</div>
			</EinkCard>
		);
	}

	const events =
		mode === "today" ? getTodayEvents(data) : getUpcomingEvents(data, 8);

	const limitedEvents =
		size === "large" ? events.slice(0, 6) : events.slice(0, 3);

	return (
		<EinkCard
			title={mode === "today" ? "Today's Events" : "Upcoming"}
			icon={<EinkIcon name="calendar" size="sm" />}
			size={size}
		>
			<div className="flex flex-col gap-2">
				{limitedEvents.length === 0 ? (
					<div className="text-eink-dark text-eink-sm">
						{mode === "today" ? "No events today" : "No upcoming events"}
					</div>
				) : (
					limitedEvents.map((event, i) => (
						<EventRow
							key={event.id}
							event={event}
							isLast={i === limitedEvents.length - 1}
						/>
					))
				)}

				{events.length > limitedEvents.length && (
					<div className="text-eink-xs text-eink-dark mt-1">
						+{events.length - limitedEvents.length} more
					</div>
				)}
			</div>
		</EinkCard>
	);
}

function EventRow({
	event,
	isLast,
}: {
	event: CalendarEvent;
	isLast: boolean;
}) {
	const now = new Date();
	const startTime = new Date(event.startTime);
	const isNow =
		!event.isAllDay && startTime <= now && new Date(event.endTime) > now;
	const isSoon =
		!event.isAllDay &&
		startTime > now &&
		startTime.getTime() - now.getTime() < 30 * 60 * 1000;

	return (
		<div
			className={`
        flex gap-2
        ${!isLast ? "pb-2 border-b border-eink-light" : ""}
        ${isNow ? "bg-eink-light -mx-2 px-2 py-1" : ""}
      `}
		>
			{/* Time column */}
			<div className="w-16 shrink-0">
				{event.isAllDay ? (
					<span className="text-eink-xs text-eink-dark">All day</span>
				) : (
					<span className={`text-eink-sm ${isSoon ? "font-bold" : ""}`}>
						{startTime.toLocaleTimeString("en-AU", {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false,
							timeZone: LOCATION.timezone,
						})}
					</span>
				)}
			</div>

			{/* Event details */}
			<div className="flex-1 min-w-0">
				<div className={`text-eink-sm truncate ${isNow ? "font-bold" : ""}`}>
					{event.title}
				</div>
				{event.location && (
					<div className="text-eink-xs text-eink-dark truncate">
						@ {event.location}
					</div>
				)}
			</div>

			{/* Status indicators */}
			{isNow && (
				<div className="shrink-0 text-eink-xs border-2 border-eink-black px-1 h-fit">
					NOW
				</div>
			)}
			{isSoon && !isNow && (
				<div className="shrink-0 text-eink-xs text-eink-dark">Soon</div>
			)}
		</div>
	);
}
