import { describe, expect, it } from "vitest";
import { mergePsnHistory } from "./playstation";

const NO_TROPHIES = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

describe("mergePsnHistory", () => {
	it("keeps games from the played list with their play time, and drops apps", () => {
		const history = mergePsnHistory(
			[
				{
					name: "Astro Bot",
					category: "ps5_native_game",
					playDuration: "PT12H30M",
				},
				{
					name: "Netflix",
					category: "ps5_native_media_app",
					playDuration: "PT90H",
				},
				{ name: "Mystery", category: "unknown", playDuration: "PT1H" },
			],
			[],
		);
		expect(history).toEqual([{ name: "Astro Bot", minutesPlayed: 750 }]);
	});

	it("adds the trophies earned to the played game of the same name", () => {
		const history = mergePsnHistory(
			[
				{
					name: "ASTRO BOT®",
					category: "ps5_native_game",
					playDuration: "PT10M",
				},
			],
			[
				{
					trophyTitleName: "Astro Bot",
					earnedTrophies: { bronze: 3, silver: 1, gold: 0, platinum: 0 },
				},
			],
		);
		expect(history).toEqual([
			{ name: "ASTRO BOT®", minutesPlayed: 10, achievements: 4 },
		]);
	});

	it("keeps a trophy title with no counterpart in the played list, with no play time", () => {
		const history = mergePsnHistory(
			[
				{
					name: "Uncharted: The Nathan Drake Collection",
					category: "ps4_game",
					playDuration: "PT40H",
				},
			],
			[
				{
					trophyTitleName: "Uncharted 2: Among Thieves Remastered",
					earnedTrophies: { bronze: 20, silver: 2, gold: 1, platinum: 0 },
				},
				{ trophyTitleName: "Untouched Demo", earnedTrophies: NO_TROPHIES },
			],
		);
		expect(history).toEqual([
			{ name: "Uncharted: The Nathan Drake Collection", minutesPlayed: 2400 },
			{ name: "Uncharted 2: Among Thieves Remastered", achievements: 23 },
			{ name: "Untouched Demo", achievements: 0 },
		]);
	});
});
