import { type Game, IN_PROGRESS_DAYS, PLATFORM_NAMES } from "@/types/gaming";
import type { MediumContent, SpotlightCandidate } from "./types";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function plural(count: number, unit: string): string {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** When something happened, relative to now: "3 hours ago", "yesterday". */
export function formatWhen(at: string, now: Date): string {
	const elapsed = Math.max(0, now.getTime() - new Date(at).getTime());
	if (elapsed < MINUTE_MS) return "just now";
	if (elapsed < HOUR_MS) {
		return `${plural(Math.floor(elapsed / MINUTE_MS), "minute")} ago`;
	}
	if (elapsed < DAY_MS) {
		return `${plural(Math.floor(elapsed / HOUR_MS), "hour")} ago`;
	}
	const days = Math.floor(elapsed / DAY_MS);
	if (days === 1) return "yesterday";
	if (days < 14) return `${days} days ago`;
	if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
	if (days < 365) return `${Math.floor(days / 30)} months ago`;
	return `${plural(Math.floor(days / 365), "year")} ago`;
}

/** Play time as whole hours, or minutes under an hour. */
export function formatHours(minutes: number): string {
	if (minutes < 60) {
		return plural(minutes, "minute");
	}
	return plural(Math.round(minutes / 60), "hour");
}

function toCandidate(
	game: Game & { posterUrl: string; lastPlayedAt: string },
	now: Date,
): SpotlightCandidate {
	const facts = [`Played ${formatWhen(game.lastPlayedAt, now)}`];
	if (game.minutesPlayed !== undefined) {
		facts.unshift(`${formatHours(game.minutesPlayed)} in total`);
	}
	return {
		id: `game:${game.id}`,
		medium: "game",
		mode: "In progress",
		title: game.name,
		byline: PLATFORM_NAMES[game.platform],
		facts,
		text: game.description,
		activityAt: game.lastPlayedAt,
		posterUrl: game.posterUrl,
	};
}

/**
 * What games contribute to the screen. A game is only ever In progress:
 * eligible for the Spotlight when played in the last 14 days and it has
 * artwork. `games` is most recently played first.
 */
export function gamesContent(games: Game[], now: Date): MediumContent {
	const withArtwork = games.filter(
		(game): game is Game & { posterUrl: string; lastPlayedAt: string } =>
			Boolean(game.posterUrl && game.lastPlayedAt),
	);
	const fallback = withArtwork.map((game) => toCandidate(game, now));
	const eligible = fallback.filter(
		(candidate) =>
			now.getTime() - new Date(candidate.activityAt).getTime() <=
			IN_PROGRESS_DAYS * DAY_MS,
	);

	const latest = games[0];
	return {
		medium: "game",
		eligible,
		fallback,
		latest: latest
			? {
					title: latest.name,
					detail:
						latest.minutesPlayed !== undefined
							? `${formatHours(latest.minutesPlayed)} played`
							: undefined,
					at: latest.lastPlayedAt,
					thumbnailUrl: latest.thumbnailUrl,
				}
			: null,
	};
}
