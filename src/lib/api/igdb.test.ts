import { describe, expect, it } from "vitest";
import { pickByName } from "@/lib/igdb/client";
import { toFiveStars } from "./igdb";

describe("pickByName", () => {
	const results = [
		{ name: "Hades II: Supporter Pack" },
		{ name: "Hades" },
		{ name: "HADES II" },
	];

	it("picks the result whose name matches, ignoring case and punctuation", () => {
		expect(pickByName(results, "Hades II")?.name).toBe("HADES II");
	});

	it("narrows to the game first released in a given year", () => {
		const remakes = [
			{ name: "Resident Evil 4", first_release_date: 1105401600 },
			{ name: "Resident Evil 4", first_release_date: 1679616000 },
		];
		expect(pickByName(remakes, "Resident Evil 4", 2023)).toBe(remakes[1]);
		expect(pickByName(remakes, "Resident Evil 4", 1999)).toBeUndefined();
	});

	it("picks nothing when no name matches exactly", () => {
		expect(pickByName(results, "Hades III")).toBeUndefined();
	});
});

describe("toFiveStars", () => {
	it("converts a 0-100 rating to half-star steps out of five", () => {
		expect(toFiveStars(100)).toBe(5);
		expect(toFiveStars(87.4)).toBe(4.5);
		expect(toFiveStars(84)).toBe(4);
		expect(toFiveStars(0)).toBe(0);
	});
});
