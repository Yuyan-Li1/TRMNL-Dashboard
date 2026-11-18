import { describe, expect, it } from "vitest";
import type { Show } from "@/types/shows";
import { showsContent } from "./shows";

// 09:00 on 18 November 2026 in Sydney
const NOW = new Date("2026-11-17T22:00:00Z");
const POSTER = "https://image.tmdb.org/t/p/w780/severance.jpg";

function show(overrides: Partial<Show>): Show {
	return {
		id: 1,
		title: "Severance",
		year: 2022,
		tmdbId: 95396,
		season: 2,
		episode: 5,
		// The 15th in Sydney
		watchedAt: "2026-11-15T09:30:00.000Z",
		progress: { watched: 5, aired: 8, state: "watching" },
		overview: "Mark leads a team whose memories have been divided.",
		publicRating: 4,
		posterUrl: POSTER,
		thumbnailUrl: POSTER,
		...overrides,
	};
}

describe("showsContent", () => {
	it("shows a show being watched as In progress with its season, the latest episode, when, progress through the aired episodes and the overview", () => {
		const content = showsContent([show({})], NOW);

		expect(content.eligible).toEqual([
			{
				id: "show:1",
				medium: "show",
				mode: "In progress",
				title: "Severance",
				byline: "Season 2",
				facts: ["S2 E5", "Watched 3 days ago"],
				progress: 0.625,
				text: "Mark leads a team whose memories have been divided.",
				activityAt: "2026-11-15T00:00:00.000Z",
				posterUrl: POSTER,
			},
		]);
	});

	it("says caught up when every aired episode is watched, still In progress", () => {
		const [candidate] = showsContent(
			[show({ progress: { watched: 5, aired: 5, state: "caught up" } })],
			NOW,
		).eligible;

		expect(candidate.mode).toBe("In progress");
		expect(candidate.facts).toEqual(["S2 E5, caught up", "Watched 3 days ago"]);
		expect(candidate.progress).toBe(1);
	});

	it("shows a finished season as Finished, from the day its last episode was watched, with no progress bar or rating", () => {
		const [candidate] = showsContent(
			[
				show({
					episode: 8,
					watchedAt: "2026-11-16T09:30:00.000Z",
					progress: {
						watched: 8,
						aired: 8,
						state: "finished",
						finishedAt: "2026-11-16T09:30:00.000Z",
					},
				}),
			],
			NOW,
		).eligible;

		expect(candidate.mode).toBe("Finished");
		expect(candidate.byline).toBe("Season 2");
		expect(candidate.facts).toEqual(["Season finished", "Watched 2 days ago"]);
		expect(candidate.progress).toBeUndefined();
		expect(candidate.rating).toBeUndefined();
		expect(candidate.activityAt).toBe("2026-11-16T00:00:00.000Z");
	});

	it("keeps an In progress show eligible for 14 days from its latest watch", () => {
		const content = showsContent(
			[
				show({ id: 1, watchedAt: "2026-11-04T02:00:00.000Z" }),
				show({ id: 2, watchedAt: "2026-11-03T02:00:00.000Z" }),
			],
			NOW,
		);

		expect(content.eligible.map((candidate) => candidate.id)).toEqual([
			"show:1",
		]);
		expect(content.fallback.map((candidate) => candidate.id)).toEqual([
			"show:1",
			"show:2",
		]);
	});

	it("keeps a Finished show eligible for 14 days from the watch that finished it, whatever was watched since", () => {
		const finished = {
			watched: 8,
			aired: 8,
			state: "finished" as const,
			finishedAt: "2026-10-20T09:30:00.000Z",
		};
		const content = showsContent(
			[show({ watchedAt: "2026-11-16T09:30:00.000Z", progress: finished })],
			NOW,
		);

		expect(content.eligible).toEqual([]);
		expect(content.fallback.map((candidate) => candidate.mode)).toEqual([
			"Finished",
		]);
	});

	it("shows a show whose seasons could not be read as In progress without a progress bar", () => {
		const [candidate] = showsContent(
			[show({ progress: undefined })],
			NOW,
		).eligible;

		expect(candidate.mode).toBe("In progress");
		expect(candidate.facts).toEqual(["S2 E5", "Watched 3 days ago"]);
		expect(candidate.progress).toBeUndefined();
	});

	it("leaves a show without artwork out of the Spotlight", () => {
		const content = showsContent([show({ posterUrl: undefined })], NOW);

		expect(content.eligible).toEqual([]);
		expect(content.fallback).toEqual([]);
	});

	it("puts the latest show on the Medium card with its episode, caught up, and when, however old", () => {
		const content = showsContent(
			[
				show({
					watchedAt: "2026-08-10T02:00:00.000Z",
					progress: { watched: 5, aired: 5, state: "caught up" },
				}),
				show({ id: 2, title: "Older" }),
			],
			NOW,
		);

		expect(content.latest).toEqual({
			title: "Severance",
			detail: "S2 E5, caught up",
			when: "3 months ago",
			thumbnailUrl: POSTER,
		});
	});

	it("has no latest activity with nothing watched", () => {
		expect(showsContent([], NOW).latest).toBeNull();
	});
});
