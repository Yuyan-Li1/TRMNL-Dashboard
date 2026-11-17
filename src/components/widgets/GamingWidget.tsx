import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";
import { type GamingData, PLATFORM_NAMES } from "@/types/gaming";

interface GamingWidgetProps {
	data: GamingData | null;
	limit?: number;
}

/** A plain list of recent games, standing in until the new screen lands. */
export function GamingWidget({ data, limit = 8 }: GamingWidgetProps) {
	const games = data?.games.slice(0, limit) ?? [];

	return (
		<EinkCard
			title="Recently Played"
			icon={<EinkIcon name="gamepad" size="sm" />}
		>
			{games.length === 0 ? (
				<div className="type-16 text-eink-dark">No recent games</div>
			) : (
				games.map((game) => (
					<div key={game.id} className="flex items-center gap-2 pb-1">
						<div className="min-w-0 flex-1 truncate type-16">{game.name}</div>
						<span className="shrink-0 type-12 text-eink-dark">
							{PLATFORM_NAMES[game.platform]}
							{game.minutesPlayed !== undefined &&
								` · ${Math.round(game.minutesPlayed / 60)}h`}
						</span>
					</div>
				))
			)}
		</EinkCard>
	);
}
