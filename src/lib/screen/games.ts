import { isInProgress } from "@/lib/games/titles";
import { type Game, PLATFORM_NAMES } from "@/types/gaming";
import { formatHours, formatWhen } from "./format";
import type { MediumContent, SpotlightCandidate } from "./types";

/** A game that can be the Spotlight: it has artwork and a last played date. */
interface SpotlightGame extends Game {
	posterUrl: string;
	lastPlayedAt: string;
}

function toCandidate(game: SpotlightGame, now: Date): SpotlightCandidate {
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
	const withArtwork = games.filter((game): game is SpotlightGame =>
		Boolean(game.posterUrl && game.lastPlayedAt),
	);
	const fallback = withArtwork.map((game) => toCandidate(game, now));
	const eligible = fallback.filter((candidate) =>
		isInProgress({ lastPlayedAt: candidate.activityAt }, now),
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
