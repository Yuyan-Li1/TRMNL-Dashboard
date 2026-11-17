import { describe, expect, it } from "vitest";
import type { Movie } from "@/types/movies";
import { moviesContent } from "./movies";

// 09:00 on 18 November 2026 in Sydney
const NOW = new Date("2026-11-17T22:00:00Z");

function movie(overrides: Partial<Movie>): Movie {
	return {
		id: "letterboxd-watch-1001",
		title: "Past Lives",
		year: 2023,
		watchedOn: "2026-11-17",
		rewatch: false,
		stars: 4.5,
		tmdbId: "666277",
		releaseYear: 2023,
		director: "Celine Song",
		overview: "Nora and Hae Sung are wrested apart as children.",
		posterUrl: "https://image.tmdb.org/t/p/w780/past-lives.jpg",
		thumbnailUrl: "https://image.tmdb.org/t/p/w780/past-lives.jpg",
		...overrides,
	};
}

describe("moviesContent", () => {
	it("shows a recently watched movie as Finished with year and director, the owner's stars, when it was watched and the overview", () => {
		const content = moviesContent([movie({})], NOW);

		expect(content.eligible).toEqual([
			{
				id: "movie:666277",
				medium: "movie",
				mode: "Finished",
				title: "Past Lives",
				byline: "2023, Celine Song",
				rating: { stars: 4.5, whose: "You" },
				facts: ["Watched yesterday"],
				text: "Nora and Hae Sung are wrested apart as children.",
				activityAt: "2026-11-17T00:00:00.000Z",
				posterUrl: "https://image.tmdb.org/t/p/w780/past-lives.jpg",
			},
		]);
	});

	it("shows the owner's review in place of the overview", () => {
		const [candidate] = moviesContent(
			[movie({ review: "Quietly devastating." })],
			NOW,
		).eligible;

		expect(candidate.text).toBe("Quietly devastating.");
	});

	it("says Rewatch when the entry is flagged, and omits the rating when there is none", () => {
		const [candidate] = moviesContent(
			[movie({ rewatch: true, stars: undefined })],
			NOW,
		).eligible;

		expect(candidate.facts).toEqual(["Watched yesterday", "Rewatch"]);
		expect(candidate.rating).toBeUndefined();
	});

	it("falls back to the feed's year when the Catalog has no details", () => {
		const [candidate] = moviesContent(
			[movie({ releaseYear: undefined, director: undefined })],
			NOW,
		).eligible;

		expect(candidate.byline).toBe("2023");
	});

	it("keeps a movie eligible for 14 days from its watched date", () => {
		const content = moviesContent(
			[
				movie({ id: "a", tmdbId: "1", watchedOn: "2026-11-04" }),
				movie({ id: "b", tmdbId: "2", watchedOn: "2026-11-03" }),
			],
			NOW,
		);

		expect(content.eligible.map((candidate) => candidate.id)).toEqual([
			"movie:1",
		]);
		expect(content.fallback.map((candidate) => candidate.id)).toEqual([
			"movie:1",
			"movie:2",
		]);
	});

	it("leaves a movie without artwork out of the Spotlight", () => {
		const content = moviesContent([movie({ posterUrl: undefined })], NOW);

		expect(content.eligible).toEqual([]);
		expect(content.fallback).toEqual([]);
	});

	it("offers a movie watched twice once, as its latest watch", () => {
		const content = moviesContent(
			[
				movie({ id: "second", watchedOn: "2026-11-17", rewatch: true }),
				movie({ id: "first", watchedOn: "2026-11-10" }),
			],
			NOW,
		);

		expect(content.eligible).toHaveLength(1);
		expect(content.eligible[0].facts).toEqual(["Watched yesterday", "Rewatch"]);
	});

	it("puts the latest diary entry on the Medium card, however old", () => {
		const content = moviesContent(
			[movie({ watchedOn: "2026-08-10" }), movie({ id: "older" })],
			NOW,
		);

		expect(content.latest).toEqual({
			title: "Past Lives",
			stars: 4.5,
			detail: "Watched",
			when: "3 months ago",
			thumbnailUrl: "https://image.tmdb.org/t/p/w780/past-lives.jpg",
		});
	});

	it("has no latest activity with an empty diary", () => {
		expect(moviesContent([], NOW).latest).toBeNull();
	});
});
