import { describe, expect, it } from "vitest";
import { daysSinceWatched, isEligibleForSpotlight } from "./diary";

describe("daysSinceWatched", () => {
	it("counts calendar days in the owner's time zone, not elapsed hours", () => {
		// 09:00 on 18 November in Sydney is still 17 November in UTC
		const morning = new Date("2026-11-17T22:00:00Z");

		expect(daysSinceWatched("2026-11-18", morning)).toBe(0);
		expect(daysSinceWatched("2026-11-17", morning)).toBe(1);
		expect(daysSinceWatched("2026-11-04", morning)).toBe(14);
	});

	it("treats a watched date ahead of the owner's day as today", () => {
		expect(
			daysSinceWatched("2026-11-20", new Date("2026-11-17T22:00:00Z")),
		).toBe(0);
	});
});

describe("isEligibleForSpotlight", () => {
	it("holds for 14 days from the watched date", () => {
		const now = new Date("2026-11-17T22:00:00Z");

		expect(isEligibleForSpotlight({ watchedOn: "2026-11-04" }, now)).toBe(true);
		expect(isEligibleForSpotlight({ watchedOn: "2026-11-03" }, now)).toBe(
			false,
		);
	});
});
