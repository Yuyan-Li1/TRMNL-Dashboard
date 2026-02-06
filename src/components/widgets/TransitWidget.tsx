import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";
import { formatDelay } from "@/lib/api/transport";
import { TRAIN_LINES, type TransitData } from "@/types/transport";

interface TransitWidgetProps {
	data: TransitData | null;
	size?: "small" | "medium" | "large";
	limit?: number;
}

export function TransitWidget({
	data,
	size = "medium",
	limit = 4,
}: TransitWidgetProps) {
	if (!data) {
		return (
			<EinkCard
				title="Trains"
				icon={<EinkIcon name="train" size="sm" />}
				size={size}
			>
				<div className="flex items-center justify-center h-full text-eink-dark">
					No transit data
				</div>
			</EinkCard>
		);
	}

	const departures = data.departures.slice(0, limit);
	const hasDelays = departures.some((d) => d.status === "delayed");

	return (
		<EinkCard
			title={data.stationName}
			icon={<EinkIcon name="train" size="sm" />}
			size={size}
			variant={hasDelays ? "filled" : "default"}
		>
			<div className="flex flex-col gap-2">
				{departures.length === 0 ? (
					<div className="text-eink-dark text-eink-sm">
						No upcoming departures
					</div>
				) : (
					departures.map((dep, i) => {
						const _lineInfo = TRAIN_LINES[dep.routeShortName];
						const departureTime = new Date(
							dep.estimatedTime || dep.scheduledTime,
						);
						const timeStr = departureTime.toLocaleTimeString("en-AU", {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false,
						});

						return (
							<div
								key={`${dep.routeShortName}-${dep.scheduledTime}`}
								className={`
                  flex items-center justify-between
                  ${i < departures.length - 1 ? "pb-2 border-b border-eink-light" : ""}
                `}
							>
								<div className="flex items-center gap-2">
									{/* Line indicator */}
									<div
										className="
                      w-8 h-6 flex items-center justify-center
                      border-2 border-eink-black font-bold text-eink-xs
                    "
									>
										{dep.routeShortName}
									</div>
									{/* Destination */}
									<div className="text-eink-sm truncate max-w-[180px]">
										{dep.headsign}
									</div>
								</div>

								{/* Time and status */}
								<div className="flex items-center gap-2">
									<span className="text-eink-lg font-bold">{timeStr}</span>
									{dep.status === "delayed" && (
										<span className="text-eink-xs border-2 border-eink-black px-1">
											{formatDelay(dep.delaySeconds)}
										</span>
									)}
									{dep.status === "cancelled" && (
										<span className="text-eink-xs bg-eink-black text-eink-white px-1">
											CANC
										</span>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</EinkCard>
	);
}
