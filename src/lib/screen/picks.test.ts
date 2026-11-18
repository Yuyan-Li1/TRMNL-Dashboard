import { describe, expect, it } from "vitest";
import type { PoolPick, PoolTitles } from "@/lib/picks/pool";
import { picksContent, poolPickId } from "./picks";

const PAST_LIVES: PoolPick = {
	medium: "movie",
	catalogId: "666277",
	origin: "catalog",
	reason: "Because you watched Aftersun",
	enteredOn: "2026-11-16",
};

const TITLES: PoolTitles = {
	"movie:666277": {
		title: "Past Lives",
		year: 2023,
		director: "Celine Song",
		description: "Nora and Hae Sung are wrested apart as children.",
		publicRating: 4,
		posterUrl: "https://image.tmdb.org/t/p/w780/past-lives.jpg",
	},
	"show:95396": {
		title: "Severance",
		year: 2022,
		publicRating: 4.5,
		posterUrl: "https://image.tmdb.org/t/p/w780/severance.jpg",
	},
	"game:1877": {
		title: "Cyberpunk 2077",
		platforms: ["PC", "PS4", "XONE", "PS5", "Series X|S", "Stadia"],
		publicRating: 4,
		posterUrl: "https://images.igdb.com/cyberpunk.jpg",
	},
};

describe("picksContent", () => {
	it("makes a pick a Recommendation with its reason, the Catalog's rating and its description", () => {
		expect(picksContent([PAST_LIVES], TITLES)).toEqual([
			{
				id: "pick:movie:666277",
				medium: "movie",
				mode: "Recommendation",
				title: "Past Lives",
				byline: "2023, Celine Song",
				rating: { stars: 4, whose: "TMDB" },
				reason: "Because you watched Aftersun",
				facts: [],
				text: "Nora and Hae Sung are wrested apart as children.",
				activityAt: "2026-11-16T00:00:00.000Z",
				posterUrl: "https://image.tmdb.org/t/p/w780/past-lives.jpg",
			},
		]);
	});

	it("gives a show the year it first aired, and a game its Platforms and IGDB's rating", () => {
		const [show, game] = picksContent(
			[
				{ ...PAST_LIVES, medium: "show", catalogId: "95396" },
				{ ...PAST_LIVES, medium: "game", catalogId: "1877" },
			],
			TITLES,
		);
		expect(show.byline).toBe("2022");
		expect(show.rating).toEqual({ stars: 4.5, whose: "TMDB" });
		expect(game.byline).toBe("PC, PS4, XONE, PS5");
		expect(game.rating).toEqual({ stars: 4, whose: "IGDB" });
	});

	it("cuts the description to about 140 characters, at a word", () => {
		const description =
			"A sprawling role-playing adventure set in a vast open world, where every choice reshapes the fate of kingdoms, and where ancient powers stir beneath the mountains once more.";
		const [candidate] = picksContent([PAST_LIVES], {
			"movie:666277": { ...TITLES["movie:666277"], description },
		});
		expect(candidate.text).toBe(
			"A sprawling role-playing adventure set in a vast open world, where every choice reshapes the fate of kingdoms, and where ancient powers stir...",
		);
	});

	it("shows no rating when the Catalog has none", () => {
		const [candidate] = picksContent([PAST_LIVES], {
			"movie:666277": { ...TITLES["movie:666277"], publicRating: undefined },
		});
		expect(candidate.rating).toBeUndefined();
	});

	it("leaves out a pick whose title is not stored", () => {
		expect(picksContent([{ ...PAST_LIVES, catalogId: "1" }], TITLES)).toEqual(
			[],
		);
	});
});

describe("poolPickId", () => {
	it("names the pick behind a Recommendation, for counting its appearances", () => {
		const [candidate] = picksContent([PAST_LIVES], TITLES);
		expect(poolPickId(candidate)).toBe("movie:666277");
	});

	it("is undefined for a Title that is not a pick", () => {
		const [candidate] = picksContent([PAST_LIVES], TITLES);
		expect(
			poolPickId({ ...candidate, id: "movie:666277", mode: "Finished" }),
		).toBeUndefined();
	});
});
