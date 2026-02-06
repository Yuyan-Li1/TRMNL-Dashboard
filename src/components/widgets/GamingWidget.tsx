import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";
import { formatPlaytime, getPlatformIcon } from "@/lib/api/gaming";
import type { GamingData, RecentGame } from "@/types/gaming";

interface GamingWidgetProps {
	data: GamingData | null;
	size?: "small" | "medium" | "large";
	limit?: number;
}

export function GamingWidget({
	data,
	size = "medium",
	limit = 3,
}: GamingWidgetProps) {
	if (!data) {
		return (
			<EinkCard
				title="Gaming"
				icon={<EinkIcon name="gamepad" size="sm" />}
				size={size}
			>
				<div className="flex items-center justify-center h-full text-eink-dark">
					No gaming data
				</div>
			</EinkCard>
		);
	}

	const games = data.allRecentGames.slice(
		0,
		size === "large" ? limit + 2 : limit,
	);

	return (
		<EinkCard
			title="Recently Played"
			icon={<EinkIcon name="gamepad" size="sm" />}
			size={size}
		>
			<div className="flex flex-col gap-2">
				{games.length === 0 ? (
					<div className="text-eink-dark text-eink-sm">No recent games</div>
				) : (
					games.map((game, i) => (
						<GameRow
							key={`${game.platform}-${game.gameId}`}
							game={game}
							isLast={i === games.length - 1}
						/>
					))
				)}
			</div>
		</EinkCard>
	);
}

function formatLastPlayed(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return `${Math.floor(days / 30)}mo ago`;
}

function GameRow({ game, isLast }: { game: RecentGame; isLast: boolean }) {
	const earned = game.achievementsEarned;
	const total = game.achievementsTotal;
	const hasPercentage =
		earned !== undefined && total !== undefined && total > 0;
	const achievementPercent = hasPercentage
		? Math.round((earned / total) * 100)
		: null;

	// Secondary info: playtime for Steam, last played for others
	let secondaryText: string | null = null;
	if (game.playtimeRecent) {
		secondaryText = `${formatPlaytime(game.playtimeRecent)} recent`;
	} else if (game.playtimeTotal) {
		secondaryText = `${formatPlaytime(game.playtimeTotal)} total`;
	} else if (game.lastPlayed) {
		secondaryText = formatLastPlayed(game.lastPlayed);
	}

	return (
		<div
			className={`
        flex items-center gap-2
        ${!isLast ? "pb-2 border-b border-eink-light" : ""}
      `}
		>
			{/* Platform icon */}
			<EinkIcon
				name={getPlatformIcon(game.platform)}
				size="sm"
				className="shrink-0"
			/>

			{/* Game info */}
			<div className="flex-1 min-w-0">
				<div className="text-eink-sm font-medium truncate">{game.title}</div>
			</div>

			{/* Right side: achievement bar OR secondary text */}
			{achievementPercent !== null ? (
				<div className="shrink-0 flex items-center gap-1">
					<div className="w-12 h-2 border border-eink-dark">
						<div
							className="h-full bg-eink-black"
							style={{ width: `${achievementPercent}%` }}
						/>
					</div>
					<span className="text-eink-xs">{achievementPercent}%</span>
				</div>
			) : (
				secondaryText && (
					<span className="shrink-0 text-eink-xs text-eink-dark">
						{secondaryText}
					</span>
				)
			)}
		</div>
	);
}
