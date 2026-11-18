import { describe, expect, it } from "vitest";
import { toCatalogMovie, toCatalogShow } from "./tmdb";

const PAST_LIVES = {
	title: "Past Lives",
	overview: "Nora and Hae Sung are wrested apart as children.",
	release_date: "2023-06-02",
	poster_path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
	vote_average: 7.741,
	vote_count: 2500,
	credits: {
		crew: [
			{ job: "Producer", name: "David Hinojosa" },
			{ job: "Director", name: "Celine Song" },
		],
	},
};

describe("toCatalogMovie", () => {
	it("reads the poster, overview, release year, director and rating in five stars", () => {
		expect(toCatalogMovie(PAST_LIVES)).toEqual({
			posterUrl:
				"https://image.tmdb.org/t/p/w780/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
			overview: "Nora and Hae Sung are wrested apart as children.",
			year: 2023,
			director: "Celine Song",
			rating: 4,
		});
	});

	it("names every director of a movie with more than one", () => {
		const movie = toCatalogMovie({
			...PAST_LIVES,
			credits: {
				crew: [
					{ job: "Director", name: "Joel Coen" },
					{ job: "Director", name: "Ethan Coen" },
				],
			},
		});

		expect(movie.director).toBe("Joel Coen, Ethan Coen");
	});

	it("leaves out what TMDB does not have", () => {
		expect(
			toCatalogMovie({
				title: "Untitled",
				overview: "",
				release_date: "",
				poster_path: null,
				vote_average: 0,
				vote_count: 0,
			}),
		).toEqual({});
	});
});

describe("toCatalogShow", () => {
	it("reads the poster, overview and rating in five stars", () => {
		expect(
			toCatalogShow({
				name: "Ted Lasso",
				overview: "An American football coach moves to England.",
				poster_path: "/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg",
				vote_average: 8.4,
				vote_count: 3100,
			}),
		).toEqual({
			posterUrl:
				"https://image.tmdb.org/t/p/w780/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg",
			overview: "An American football coach moves to England.",
			rating: 4,
		});
	});

	it("leaves out what TMDB does not have", () => {
		expect(
			toCatalogShow({
				name: "Untitled",
				overview: "",
				poster_path: null,
				vote_average: 0,
				vote_count: 0,
			}),
		).toEqual({});
	});
});
