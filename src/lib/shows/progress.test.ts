import { describe, expect, it } from "vitest";
import type {
	NextEpisode,
	ShowSchedule,
	WatchedEpisode,
	WatchedSeason,
} from "@/types/shows";
import {
	daysSinceWatch,
	isRecentWatch,
	latestWatches,
	seasonProgress,
} from "./progress";

function watch(overrides: Partial<WatchedEpisode>): WatchedEpisode {
	return {
		showId: 1,
		showTitle: "Ted Lasso",
		season: 1,
		number: 1,
		watchedAt: "2026-11-14T09:30:00.000Z",
		...overrides,
	};
}

/** A season with episodes 1 to `count` watched, one a day from 1 November. */
function watchedSeason(number: number, count: number): WatchedSeason {
	return {
		number,
		episodes: Array.from({ length: count }, (_, index) => ({
			number: index + 1,
			lastWatchedAt: `2026-11-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
		})),
	};
}

/** A schedule from `[episode count, aired]` pairs for seasons 1 onwards. */
function schedule(
	counts: [number, number][],
	nextEpisode: NextEpisode | null = null,
): ShowSchedule {
	return {
		seasons: [
			{ number: 0, episodeCount: 5, airedEpisodes: 5 },
			...counts.map(([episodeCount, airedEpisodes], index) => ({
				number: index + 1,
				episodeCount,
				airedEpisodes,
			})),
		],
		nextEpisode,
		fetchedAt: "2026-11-17T00:00:00.000Z",
	};
}

describe("latestWatches", () => {
	it("gives one entry for a show however many episodes were watched: the latest", () => {
		const latest = latestWatches([
			watch({ season: 2, number: 5, watchedAt: "2026-11-14T09:30:00.000Z" }),
			watch({ season: 2, number: 4, watchedAt: "2026-11-13T09:30:00.000Z" }),
			watch({ showId: 2, showTitle: "Nathan for You", number: 7 }),
		]);

		expect(
			latest.map(({ showId, season, number }) => [showId, season, number]),
		).toEqual([
			[1, 2, 5],
			[2, 1, 7],
		]);
	});

	it("takes the furthest episode of those marked watched at the same moment", () => {
		const [latest] = latestWatches([
			watch({ season: 1, number: 9 }),
			watch({ season: 2, number: 1 }),
			watch({ season: 1, number: 10 }),
		]);

		expect([latest.season, latest.number]).toEqual([2, 1]);
	});

	it("ignores specials", () => {
		const latest = latestWatches([
			watch({ season: 0, number: 3, watchedAt: "2026-11-15T09:30:00.000Z" }),
			watch({ season: 2, number: 5 }),
			watch({ showId: 2, season: 0, number: 1 }),
		]);

		expect(
			latest.map(({ showId, season, number }) => [showId, season, number]),
		).toEqual([[1, 2, 5]]);
	});
});

describe("seasonProgress", () => {
	it("is finished when the season has ended and every episode is watched, as of its last episode", () => {
		// Ted Lasso: 10, 12, 12 and 10 episodes, all aired, nothing scheduled
		const progress = seasonProgress(
			4,
			[watchedSeason(3, 12), watchedSeason(4, 10)],
			schedule([
				[10, 10],
				[12, 12],
				[12, 12],
				[10, 10],
			]),
		);

		expect(progress).toEqual({
			watched: 10,
			aired: 10,
			state: "finished",
			finishedAt: "2026-11-10T10:00:00.000Z",
		});
	});

	it("is not finished with an episode of an ended season unwatched", () => {
		// Nathan for You: season 1 is 7 of 8
		const progress = seasonProgress(
			1,
			[watchedSeason(1, 7)],
			schedule([
				[8, 8],
				[8, 8],
			]),
		);

		expect(progress).toEqual({ watched: 7, aired: 8, state: "watching" });
	});

	it("is caught up with every aired episode watched while the season is still running", () => {
		const progress = seasonProgress(
			2,
			[watchedSeason(2, 5)],
			schedule([
				[10, 10],
				[10, 5],
			]),
		);

		expect(progress).toEqual({ watched: 5, aired: 5, state: "caught up" });
	});

	it("is caught up, not finished, while another episode of the season is scheduled", () => {
		const progress = seasonProgress(
			1,
			[watchedSeason(1, 8)],
			schedule([[8, 8]], { season: 1, number: 9 }),
		);

		expect(progress?.state).toBe("caught up");
	});

	it("is finished when the next scheduled episode is in a later season", () => {
		const progress = seasonProgress(
			1,
			[watchedSeason(1, 8)],
			schedule(
				[
					[8, 8],
					[8, 0],
				],
				{ season: 2, number: 1 },
			),
		);

		expect(progress?.state).toBe("finished");
	});

	it("is watching with aired episodes still to watch", () => {
		const progress = seasonProgress(
			1,
			[watchedSeason(1, 3)],
			schedule([[10, 6]]),
		);

		expect(progress).toEqual({ watched: 3, aired: 6, state: "watching" });
	});

	it("never lets specials block finished", () => {
		const progress = seasonProgress(
			1,
			[watchedSeason(0, 1), watchedSeason(1, 8)],
			schedule([[8, 8]]),
		);

		expect(progress?.state).toBe("finished");
	});

	it("is unknown when Trakt does not list the season", () => {
		expect(
			seasonProgress(3, [watchedSeason(3, 2)], schedule([[8, 8]])),
		).toBeUndefined();
	});
});

describe("daysSinceWatch", () => {
	it("counts days in the owner's time zone, never hours", () => {
		// 09:00 on 18 November 2026 in Sydney
		const now = new Date("2026-11-17T22:00:00Z");

		// 23:30 UTC on the 16th is already the 17th in Sydney
		expect(daysSinceWatch("2026-11-16T23:30:00.000Z", now)).toBe(1);
		expect(daysSinceWatch("2026-11-17T20:00:00.000Z", now)).toBe(0);
	});
});

describe("isRecentWatch", () => {
	it("holds for 14 days from the day of the watch", () => {
		const now = new Date("2026-11-17T22:00:00Z");

		expect(isRecentWatch("2026-11-04T02:00:00.000Z", now)).toBe(true);
		expect(isRecentWatch("2026-11-03T02:00:00.000Z", now)).toBe(false);
	});
});
