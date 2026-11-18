import { describe, expect, it } from "vitest";
import type { Game } from "@/types/gaming";
import type { Movie } from "@/types/movies";
import type { Show } from "@/types/shows";
import {
	choosePicks,
	type PoolPick,
	type PoolRecord,
	reasonFor,
	retirePicks,
	seedGames,
	seedMovies,
	seedShows,
} from "./pool";

const NOW = new Date("2026-11-18T01:00:00Z"); // midday on the 18th in Sydney

function movie(tmdbId: string, watchedOn: string, stars?: number): Movie {
	return {
		id: `letterboxd-watch-${tmdbId}-${watchedOn}`,
		title: `Movie ${tmdbId}`,
		watchedOn,
		rewatch: false,
		stars,
		tmdbId,
	};
}

describe("the seeds", () => {
	it("are the movies watched in the last 90 days, newest first", () => {
		const seeds = seedMovies(
			[
				movie("1", "2026-11-17"),
				movie("2", "2026-08-20"),
				movie("3", "2026-08-19"),
			],
			NOW,
		);
		expect(seeds.map((seed) => seed.tmdbId)).toEqual(["1", "2"]);
	});

	it("skip a movie the owner rated below 3.5 stars; an unrated one counts as liked", () => {
		const seeds = seedMovies(
			[
				movie("1", "2026-11-17", 3),
				movie("2", "2026-11-16", 3.5),
				movie("3", "2026-11-15"),
			],
			NOW,
		);
		expect(seeds.map((seed) => seed.tmdbId)).toEqual(["2", "3"]);
	});

	it("hold a movie once, as its latest watch", () => {
		const seeds = seedMovies(
			[movie("1", "2026-11-17", 2), movie("1", "2026-10-01", 5)],
			NOW,
		);
		expect(seeds).toEqual([]);
	});

	it("are the shows watched and the games played in the last 90 days", () => {
		const show = (id: number, watchedAt: string): Show => ({
			id,
			title: `Show ${id}`,
			tmdbId: id,
			season: 1,
			episode: 1,
			watchedAt,
		});
		const game = (id: string, lastPlayedAt?: string): Game => ({
			id,
			name: id,
			platform: "steam",
			lastPlayedAt,
		});
		expect(
			seedShows(
				[show(1, "2026-11-10T10:00:00Z"), show(2, "2026-06-01T10:00:00Z")],
				NOW,
			).map((seed) => seed.id),
		).toEqual([1]);
		expect(
			seedGames(
				[
					game("recent", "2026-10-01T10:00:00Z"),
					game("old", "2026-01-01T10:00:00Z"),
					game("undated"),
				],
				NOW,
			).map((seed) => seed.id),
		).toEqual(["recent"]);
	});

	it("skip a game with under 30 minutes of play; one with no play time recorded counts", () => {
		const game = (id: string, minutesPlayed?: number): Game => ({
			id,
			name: id,
			platform: "steam",
			lastPlayedAt: "2026-11-10T10:00:00Z",
			minutesPlayed,
		});
		expect(
			seedGames(
				[game("tried", 29), game("played", 30), game("untimed")],
				NOW,
			).map((seed) => seed.id),
		).toEqual(["played", "untimed"]);
	});
});

describe("choosePicks", () => {
	const results: Record<string, string[]> = {
		A: ["a1", "a2", "a3"],
		B: ["b1", "b2"],
		C: ["c1"],
	};

	function choose(
		options: {
			wanted?: number;
			excluded?: string[];
			noArtwork?: string[];
			results?: Record<string, string[]>;
		} = {},
	) {
		const asked: string[] = [];
		const from = options.results ?? results;
		return choosePicks({
			seeds: Object.keys(from),
			wanted: options.wanted ?? 5,
			resultsOf: async (seed) => {
				asked.push(seed);
				return from[seed].map((catalogId) => ({ catalogId }));
			},
			isExcluded: (result) =>
				(options.excluded ?? []).includes(result.catalogId),
			accept: async (result) =>
				(options.noArtwork ?? []).includes(result.catalogId)
					? null
					: result.catalogId,
		}).then((chosen) => ({
			picks: chosen.map(({ seed, pick }) => `${seed}:${pick}`),
			asked,
		}));
	}

	it("goes round the seeds, newest first, taking each seed's best result", async () => {
		const { picks } = await choose();
		expect(picks).toEqual(["A:a1", "B:b1", "C:c1", "A:a2", "B:b2"]);
	});

	it("stops once it has as many as are wanted, without asking the seeds it did not reach", async () => {
		const { picks, asked } = await choose({ wanted: 2 });
		expect(picks).toEqual(["A:a1", "B:b1"]);
		expect(asked).toEqual(["A", "B"]);
	});

	it("skips a result that is excluded, taking the seed's next best", async () => {
		const { picks } = await choose({ wanted: 3, excluded: ["a1", "b1"] });
		expect(picks).toEqual(["A:a2", "B:b2", "C:c1"]);
	});

	it("skips a result without artwork", async () => {
		const { picks } = await choose({ wanted: 2, noArtwork: ["a1"] });
		expect(picks).toEqual(["A:a2", "B:b1"]);
	});

	it("takes a title two seeds share once", async () => {
		const { picks } = await choose({
			results: { A: ["x", "y"], B: ["x", "z"] },
		});
		expect(picks).toEqual(["A:x", "B:z", "A:y"]);
	});

	it("takes what there is when the seeds run dry", async () => {
		const { picks } = await choose({ results: { A: ["a1"], B: [] } });
		expect(picks).toEqual(["A:a1"]);
	});
});

describe("retirePicks", () => {
	function pick(catalogId: string, enteredOn = "2026-11-10"): PoolPick {
		return {
			medium: "movie",
			catalogId,
			origin: "catalog",
			reason: "Because you watched Heat",
			enteredOn,
		};
	}

	function retire(
		record: PoolRecord,
		options: { appearances?: Record<string, number>; known?: string[] } = {},
	) {
		return retirePicks(record, {
			appearances: options.appearances ?? {},
			isKnown: (candidate) =>
				(options.known ?? []).includes(candidate.catalogId),
			now: NOW,
		});
	}

	it("keeps a pick that is under 30 days old, has appeared under 3 times and is not in the owner's activity", () => {
		const record: PoolRecord = { picks: [pick("1", "2026-10-20")], barred: {} };
		expect(retire(record, { appearances: { "movie:1": 2 } })).toEqual(record);
	});

	it("retires a pick once its title appears in the owner's activity", () => {
		const after = retire(
			{ picks: [pick("1"), pick("2")], barred: {} },
			{ known: ["1"] },
		);
		expect(after.picks.map((kept) => kept.catalogId)).toEqual(["2"]);
	});

	it("retires a pick after 3 Spotlight appearances", () => {
		const after = retire(
			{ picks: [pick("1"), pick("2")], barred: {} },
			{ appearances: { "movie:1": 3, "movie:2": 2 } },
		);
		expect(after.picks.map((kept) => kept.catalogId)).toEqual(["2"]);
	});

	it("retires a pick after 30 days", () => {
		const after = retire({
			picks: [pick("1", "2026-10-19"), pick("2", "2026-10-18")],
			barred: {},
		});
		expect(after.picks.map((kept) => kept.catalogId)).toEqual(["1"]);
	});

	it("bars a retired pick from returning for 6 months, then lets it back", () => {
		const after = retire(
			{ picks: [pick("1")], barred: { "movie:9": "2026-11-18" } },
			{ known: ["1"] },
		);
		// The bar on 9 ended today; the bar on 1 ends in 6 months
		expect(after.barred).toEqual({ "movie:1": "2027-05-20" });
	});
});

describe("reasonFor", () => {
	it("says which title a Catalog pick came from", () => {
		expect(reasonFor("movie", "Heat")).toBe("Because you watched Heat");
		expect(reasonFor("show", "Severance")).toBe(
			"Because you watched Severance",
		);
		expect(reasonFor("game", "Hades II")).toBe("Because you played Hades II");
	});

	it("is never over 100 characters", () => {
		const reason = reasonFor("movie", "A Very Long Title ".repeat(10));
		expect(reason.length).toBeLessThanOrEqual(100);
		expect(reason.endsWith("...")).toBe(true);
	});
});
