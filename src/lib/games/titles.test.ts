import { describe, expect, it } from "vitest";
import { cleanGameName, mergePlays } from "./titles";

describe("cleanGameName", () => {
	it("drops the Switch 2 Edition wording and anything after it", () => {
		expect(
			cleanGameName(
				"The Legend of Zelda: Tears of the Kingdom – Nintendo Switch 2 Edition",
			),
		).toBe("The Legend of Zelda: Tears of the Kingdom");
		expect(
			cleanGameName(
				"Kirby and the Forgotten Land – Nintendo Switch 2 Edition + Star-Crossed World",
			),
		).toBe("Kirby and the Forgotten Land");
		expect(
			cleanGameName("Super Mario Party Jamboree - Nintendo Switch 2 Edition"),
		).toBe("Super Mario Party Jamboree");
	});

	it('drops "for Nintendo Switch"', () => {
		expect(
			cleanGameName("Diablo III: Eternal Collection for Nintendo Switch"),
		).toBe("Diablo III: Eternal Collection");
	});

	it("fixes all-caps names, keeping roman numerals", () => {
		expect(cleanGameName("ELDEN RING")).toBe("Elden Ring");
		expect(cleanGameName("FINAL FANTASY VII REBIRTH")).toBe(
			"Final Fantasy VII Rebirth",
		);
		expect(cleanGameName("ASTRO BOT")).toBe("Astro Bot");
	});

	it("leaves mixed-case names and short acronyms alone", () => {
		expect(cleanGameName("Hades II")).toBe("Hades II");
		expect(cleanGameName("DOOM Eternal")).toBe("DOOM Eternal");
		expect(cleanGameName("GTA V")).toBe("GTA V");
	});

	it("drops trademark symbols", () => {
		expect(cleanGameName("Rocket League®")).toBe("Rocket League");
		expect(cleanGameName("Marvel's Spider-Man™ 2")).toBe(
			"Marvel's Spider-Man 2",
		);
	});
});

describe("mergePlays", () => {
	it("makes one Title of a game played on several Platforms", () => {
		const titles = mergePlays([
			{
				platform: "steam",
				name: "Hades II",
				lastPlayedAt: "2026-11-01T10:00:00Z",
				minutesPlayed: 600,
				steamAppId: "1145350",
			},
			{
				platform: "switch2",
				name: "Hades II",
				lastPlayedAt: "2026-11-10T10:00:00Z",
				minutesPlayed: 120,
				imageUrl: "https://example.com/hades.jpg",
			},
		]);

		expect(titles).toHaveLength(1);
		expect(titles[0]).toMatchObject({
			name: "Hades II",
			platform: "switch2",
			lastPlayedAt: "2026-11-10T10:00:00Z",
			minutesPlayed: 720,
			steamAppId: "1145350",
			imageUrl: "https://example.com/hades.jpg",
		});
	});

	it("treats Switch and Switch 2 editions of a game as one Title", () => {
		const titles = mergePlays([
			{
				platform: "switch",
				name: "The Legend of Zelda: Tears of the Kingdom",
				lastPlayedAt: "2025-01-01T00:00:00Z",
				minutesPlayed: 6000,
			},
			{
				platform: "switch2",
				name: "The Legend of Zelda: Tears of the Kingdom – Nintendo Switch 2 Edition",
				lastPlayedAt: "2026-11-12T00:00:00Z",
				minutesPlayed: 300,
			},
		]);

		expect(titles).toHaveLength(1);
		expect(titles[0]).toMatchObject({
			name: "The Legend of Zelda: Tears of the Kingdom",
			platform: "switch2",
			minutesPlayed: 6300,
		});
	});

	it("matches names that differ only in case, symbols and punctuation", () => {
		const titles = mergePlays([
			{
				platform: "playstation",
				name: "ELDEN RING",
				lastPlayedAt: "2026-11-02T00:00:00Z",
			},
			{
				platform: "xbox",
				name: "Elden Ring™",
				lastPlayedAt: "2026-11-01T00:00:00Z",
			},
		]);

		expect(titles).toHaveLength(1);
		expect(titles[0].name).toBe("Elden Ring");
		expect(titles[0].platform).toBe("playstation");
	});

	it("orders Titles most recently played first, undated ones last", () => {
		const titles = mergePlays([
			{ platform: "xbox", name: "Undated" },
			{
				platform: "steam",
				name: "Older",
				lastPlayedAt: "2026-10-01T00:00:00Z",
			},
			{
				platform: "steam",
				name: "Newer",
				lastPlayedAt: "2026-11-01T00:00:00Z",
			},
		]);

		expect(titles.map((title) => title.name)).toEqual([
			"Newer",
			"Older",
			"Undated",
		]);
	});

	it("leaves hours unknown when no Platform reports play time", () => {
		const [title] = mergePlays([
			{ platform: "xbox", name: "Forza", lastPlayedAt: "2026-11-01T00:00:00Z" },
		]);
		expect(title.minutesPlayed).toBeUndefined();
	});
});
