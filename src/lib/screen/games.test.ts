import { describe, expect, it } from "vitest";
import type { Game } from "@/types/gaming";
import { formatHours, formatWhen, gamesContent } from "./games";

const NOW = new Date("2026-11-17T12:00:00Z");

function game(overrides: Partial<Game>): Game {
	return {
		id: "hadesii",
		name: "Hades II",
		platform: "steam",
		lastPlayedAt: "2026-11-17T09:00:00Z",
		minutesPlayed: 42 * 60,
		description: "Battle beyond the Underworld.",
		posterUrl: "https://example.com/hades.jpg",
		thumbnailUrl: "https://example.com/hades.jpg",
		...overrides,
	};
}

describe("formatWhen", () => {
	it.each([
		["2026-11-17T11:59:30Z", "just now"],
		["2026-11-17T11:15:00Z", "45 minutes ago"],
		["2026-11-17T11:00:00Z", "1 hour ago"],
		["2026-11-17T09:00:00Z", "3 hours ago"],
		["2026-11-16T10:00:00Z", "yesterday"],
		["2026-11-12T12:00:00Z", "5 days ago"],
		["2026-10-27T12:00:00Z", "3 weeks ago"],
		["2026-08-17T12:00:00Z", "3 months ago"],
		["2024-11-17T12:00:00Z", "2 years ago"],
	])("%s is %s", (at, expected) => {
		expect(formatWhen(at, NOW)).toBe(expected);
	});
});

describe("formatHours", () => {
	it("rounds to whole hours, and uses minutes under an hour", () => {
		expect(formatHours(42 * 60 + 20)).toBe("42 hours");
		expect(formatHours(60)).toBe("1 hour");
		expect(formatHours(45)).toBe("45 minutes");
	});
});

describe("gamesContent", () => {
	it("shows a recently played game as In progress with its Platform, facts and summary", () => {
		const content = gamesContent([game({})], NOW);

		expect(content.eligible).toEqual([
			{
				id: "game:hadesii",
				medium: "game",
				mode: "In progress",
				title: "Hades II",
				byline: "Steam",
				facts: ["42 hours in total", "Played 3 hours ago"],
				text: "Battle beyond the Underworld.",
				activityAt: "2026-11-17T09:00:00Z",
				posterUrl: "https://example.com/hades.jpg",
			},
		]);
	});

	it("leaves out the hours when the Platform does not report them", () => {
		const content = gamesContent(
			[game({ platform: "xbox", minutesPlayed: undefined })],
			NOW,
		);
		expect(content.eligible[0].byline).toBe("Xbox");
		expect(content.eligible[0].facts).toEqual(["Played 3 hours ago"]);
	});

	it("is not eligible after 14 days, but stays available as the fallback", () => {
		const old = game({ lastPlayedAt: "2026-11-01T00:00:00Z" });
		const content = gamesContent([old], NOW);
		expect(content.eligible).toEqual([]);
		expect(content.fallback.map((candidate) => candidate.id)).toEqual([
			"game:hadesii",
		]);
	});

	it("keeps a game without artwork out of the Spotlight", () => {
		const content = gamesContent([game({ posterUrl: undefined })], NOW);
		expect(content.eligible).toEqual([]);
		expect(content.fallback).toEqual([]);
	});

	it("puts the latest game on the Medium card, however old", () => {
		const content = gamesContent(
			[
				game({ lastPlayedAt: "2025-01-01T00:00:00Z" }),
				game({
					id: "older",
					name: "Older",
					lastPlayedAt: "2024-01-01T00:00:00Z",
				}),
			],
			NOW,
		);
		expect(content.latest).toEqual({
			title: "Hades II",
			detail: "42 hours played",
			at: "2025-01-01T00:00:00Z",
			thumbnailUrl: "https://example.com/hades.jpg",
		});
	});

	it("has no latest activity when no game was ever played", () => {
		expect(gamesContent([], NOW).latest).toBeNull();
	});
});
