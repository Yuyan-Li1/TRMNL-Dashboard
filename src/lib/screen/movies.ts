import { daysSinceWatched, isEligibleForSpotlight } from "@/lib/movies/diary";
import type { Movie } from "@/types/movies";
import { formatDaysAgo } from "./format";
import type { MediumContent, SpotlightCandidate } from "./types";

/** A movie that can be the Spotlight: it has artwork. */
interface SpotlightMovie extends Movie {
	posterUrl: string;
}

function watchedWhen(movie: Movie, now: Date): string {
	return formatDaysAgo(daysSinceWatched(movie.watchedOn, now));
}

function toCandidate(movie: SpotlightMovie, now: Date): SpotlightCandidate {
	const facts = [`Watched ${watchedWhen(movie, now)}`];
	if (movie.rewatch) {
		facts.push("Rewatch");
	}
	return {
		// One Title however many times it is in the diary
		id: `movie:${movie.tmdbId ?? movie.id}`,
		medium: "movie",
		mode: "Finished",
		title: movie.title,
		byline: [movie.releaseYear ?? movie.year, movie.director]
			.filter(Boolean)
			.join(", "),
		rating:
			movie.stars !== undefined
				? { stars: movie.stars, whose: "You" }
				: undefined,
		facts,
		text: movie.review ?? movie.overview,
		// The diary records the day and no time. Midnight UTC falls near the
		// middle of the owner's day, the best guess for the freshness weight.
		activityAt: new Date(`${movie.watchedOn}T00:00:00Z`).toISOString(),
		posterUrl: movie.posterUrl,
	};
}

/**
 * What movies contribute to the screen. A movie is never In progress: it is
 * Finished when logged in the diary, and eligible for the Spotlight for 14
 * days from its watched date when it has artwork. `movies` is most recently
 * watched first.
 */
export function moviesContent(movies: Movie[], now: Date): MediumContent {
	const seen = new Set<string>();
	const fallback: SpotlightCandidate[] = [];
	const eligible: SpotlightCandidate[] = [];
	for (const movie of movies) {
		if (!movie.posterUrl) {
			continue;
		}
		const candidate = toCandidate(
			{ ...movie, posterUrl: movie.posterUrl },
			now,
		);
		// A movie watched twice is offered once, as its latest watch
		if (seen.has(candidate.id)) {
			continue;
		}
		seen.add(candidate.id);
		fallback.push(candidate);
		if (isEligibleForSpotlight(movie, now)) {
			eligible.push(candidate);
		}
	}

	const latest = movies[0];
	return {
		medium: "movie",
		eligible,
		fallback,
		latest: latest
			? {
					title: latest.title,
					stars: latest.stars,
					detail: "Watched",
					when: watchedWhen(latest, now),
					thumbnailUrl: latest.thumbnailUrl,
				}
			: null,
	};
}
