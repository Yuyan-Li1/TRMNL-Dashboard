import { describe, expect, it } from "vitest";
import { pickSpotlight } from "./spotlight";
import type { Mode, SpotlightCandidate } from "./types";

const NOW = new Date("2026-11-17T00:00:00Z");

function candidate(
	id: string,
	mode: Mode,
	daysAgo: number,
): SpotlightCandidate {
	return {
		id,
		medium: "game",
		mode,
		title: id,
		byline: "",
		facts: [],
		activityAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
		posterUrl: `https://example.com/${id}.jpg`,
	};
}

/** Count how often each candidate is picked across evenly spread random values. */
function tally(
	eligible: SpotlightCandidate[],
	previousId?: string,
): Record<string, number> {
	const counts: Record<string, number> = {};
	const steps = 200;
	for (let a = 0; a < steps; a++) {
		for (let b = 0; b < steps; b++) {
			const rolls = [(a + 0.5) / steps, (b + 0.5) / steps];
			const picked = pickSpotlight({
				eligible,
				fallback: [],
				previousId,
				now: NOW,
				random: () => rolls.shift() ?? 0,
			});
			if (picked) counts[picked.id] = (counts[picked.id] ?? 0) + 1;
		}
	}
	const total = steps * steps;
	return Object.fromEntries(
		Object.entries(counts).map(([id, count]) => [id, count / total]),
	);
}

describe("pickSpotlight", () => {
	it("gives each Mode its share: 35, 25, 20, 20", () => {
		const shares = tally([
			candidate("progress", "In progress", 0),
			candidate("finished", "Finished", 0),
			candidate("friend", "Friend activity", 0),
			candidate("pick", "Recommendation", 0),
		]);
		expect(shares.progress).toBeCloseTo(0.35, 2);
		expect(shares.finished).toBeCloseTo(0.25, 2);
		expect(shares.friend).toBeCloseTo(0.2, 2);
		expect(shares.pick).toBeCloseTo(0.2, 2);
	});

	it("shares a missing Mode's weight among the rest in proportion", () => {
		const shares = tally([
			candidate("progress", "In progress", 0),
			candidate("finished", "Finished", 0),
		]);
		expect(shares.progress).toBeCloseTo(35 / 60, 2);
		expect(shares.finished).toBeCloseTo(25 / 60, 2);
	});

	it("favours fresher activity within a Mode: weight 1 / (1 + days)", () => {
		const shares = tally([
			candidate("today", "In progress", 0),
			candidate("three-days", "In progress", 3),
		]);
		// Weights 1 and 1/4
		expect(shares.today).toBeCloseTo(0.8, 2);
		expect(shares["three-days"]).toBeCloseTo(0.2, 2);
	});

	it("never picks the same Title twice in a row", () => {
		const shares = tally(
			[
				candidate("today", "In progress", 0),
				candidate("older", "In progress", 10),
			],
			"today",
		);
		expect(shares).toEqual({ older: 1 });
	});

	it("repeats the previous Title when it is the only one eligible", () => {
		const only = candidate("only", "In progress", 1);
		expect(
			pickSpotlight({
				eligible: [only],
				fallback: [],
				previousId: "only",
				now: NOW,
			}),
		).toBe(only);
	});

	it("falls back to the most recently active Title when nothing is eligible", () => {
		const recent = candidate("recent", "In progress", 30);
		const old = candidate("old", "In progress", 300);
		expect(
			pickSpotlight({
				eligible: [],
				fallback: [old, recent],
				previousId: "recent",
				now: NOW,
			}),
		).toBe(recent);
	});

	it("picks nothing when there is no Title with artwork at all", () => {
		expect(pickSpotlight({ eligible: [], fallback: [], now: NOW })).toBeNull();
	});
});
