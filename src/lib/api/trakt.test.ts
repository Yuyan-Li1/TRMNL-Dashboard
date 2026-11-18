import { describe, expect, it } from "vitest";
import {
	parseHistory,
	parseNextEpisode,
	parseSeasons,
	parseWatchedShows,
} from "./trakt";

const TED_LASSO = {
	title: "Ted Lasso",
	year: 2020,
	ids: { trakt: 158947, slug: "ted-lasso", tmdb: 97546 },
};

describe("parseHistory", () => {
	it("reads each watched episode with its show, season, number, title and when", () => {
		const history = parseHistory([
			{
				id: 9001,
				watched_at: "2026-11-14T09:30:00.000Z",
				action: "watch",
				type: "episode",
				episode: {
					season: 4,
					number: 10,
					title: "The Final Whistle",
					ids: { trakt: 1 },
				},
				show: TED_LASSO,
			},
		]);

		expect(history).toEqual([
			{
				showId: 158947,
				showTitle: "Ted Lasso",
				year: 2020,
				tmdbId: 97546,
				season: 4,
				number: 10,
				title: "The Final Whistle",
				watchedAt: "2026-11-14T09:30:00.000Z",
			},
		]);
	});

	it("leaves out what Trakt does not have, and items that are not episodes", () => {
		const history = parseHistory([
			{
				watched_at: "2026-11-14T09:30:00.000Z",
				episode: { season: 1, number: 2, title: null },
				show: { title: "Obscure", year: null, ids: { trakt: 7, tmdb: null } },
			},
			{ watched_at: "2026-11-13T09:30:00.000Z", movie: { title: "A movie" } },
		]);

		expect(history).toEqual([
			{
				showId: 7,
				showTitle: "Obscure",
				season: 1,
				number: 2,
				watchedAt: "2026-11-14T09:30:00.000Z",
			},
		]);
	});

	it("refuses an answer that is not a list", () => {
		expect(() => parseHistory({ error: "nope" })).toThrow();
	});
});

describe("parseWatchedShows", () => {
	it("reads the watched episodes of each show by season", () => {
		const watched = parseWatchedShows([
			{
				plays: 3,
				last_watched_at: "2026-11-14T09:30:00.000Z",
				show: { ...TED_LASSO, status: "returning series" },
				seasons: [
					{
						number: 1,
						episodes: [
							{
								number: 1,
								plays: 2,
								last_watched_at: "2026-01-02T00:00:00.000Z",
							},
							{
								number: 2,
								plays: 1,
								last_watched_at: "2026-01-03T00:00:00.000Z",
							},
						],
					},
				],
			},
		]);

		expect(watched).toEqual([
			{
				showId: 158947,
				seasons: [
					{
						number: 1,
						episodes: [
							{ number: 1, lastWatchedAt: "2026-01-02T00:00:00.000Z" },
							{ number: 2, lastWatchedAt: "2026-01-03T00:00:00.000Z" },
						],
					},
				],
			},
		]);
	});

	it("refuses an answer without seasons, which is what Trakt gives without `progress`", () => {
		expect(() => parseWatchedShows([{ show: TED_LASSO }])).toThrow(/seasons/);
	});
});

describe("parseSeasons", () => {
	it("reads how many episodes each season has and how many have aired, specials as season 0", () => {
		const seasons = parseSeasons([
			{ number: 0, episode_count: 3, aired_episodes: 3, title: "Specials" },
			{ number: 1, episode_count: 10, aired_episodes: 10 },
			{ number: 2, episode_count: 12, aired_episodes: 5 },
		]);

		expect(seasons).toEqual([
			{ number: 0, episodeCount: 3, airedEpisodes: 3 },
			{ number: 1, episodeCount: 10, airedEpisodes: 10 },
			{ number: 2, episodeCount: 12, airedEpisodes: 5 },
		]);
	});
});

describe("parseNextEpisode", () => {
	it("reads the next episode's season, number and air date", () => {
		expect(
			parseNextEpisode({
				season: 2,
				number: 6,
				title: "Next",
				first_aired: "2026-11-20T02:00:00.000Z",
			}),
		).toEqual({ season: 2, number: 6, airsAt: "2026-11-20T02:00:00.000Z" });
	});
});
