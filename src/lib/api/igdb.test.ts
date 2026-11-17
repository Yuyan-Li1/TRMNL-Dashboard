import { describe, expect, it } from "vitest";
import { pickByName, toFiveStars } from "./igdb";

describe("pickByName", () => {
	const results = [
		{ name: "Hades II: Supporter Pack" },
		{ name: "Hades" },
		{ name: "HADES II" },
	];

	it("picks the result whose name matches, ignoring case and punctuation", () => {
		expect(pickByName(results, "Hades II")?.name).toBe("HADES II");
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
