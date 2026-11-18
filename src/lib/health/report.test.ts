import { describe, expect, it } from "vitest";
import { healthReport } from "./report";
import type { RefreshStatus, SourceHealth } from "./status";

const NOW = new Date("2026-11-18T01:00:00Z"); // midday in Sydney
const GOOD: SourceHealth = {
	lastGoodReadAt: "2026-11-18T00:30:00Z",
	failuresInARow: 0,
};

function statusWith(
	sources: RefreshStatus["sources"],
	npssoChangedOn = "2026-11-01",
): RefreshStatus {
	return {
		lastSuccessAt: "2026-11-18T00:45:00Z",
		sources: {
			steam: GOOD,
			xbox: GOOD,
			psn: GOOD,
			switch: GOOD,
			letterboxd: GOOD,
			trakt: GOOD,
			...sources,
		},
		npsso: { fingerprint: "abc", changedOn: npssoChangedOn },
	};
}

describe("healthReport", () => {
	it("says everything is reading when nothing is wrong", () => {
		const report = healthReport(statusWith({}), NOW);

		expect(report.headline).toBe("Everything is reading.");
		expect(report.trouble).toBe(false);
		expect(report.rows.map((row) => row.state)).toEqual([
			"Reading",
			"Reading",
			"Reading",
			"Reading",
			"Reading",
			"Reading",
			"Not read yet",
			"Not read yet",
		]);
		expect(report.rows.every((row) => !row.trouble)).toBe(true);
	});

	it("names the one source that needs attention, with its error", () => {
		const report = healthReport(
			statusWith({
				xbox: {
					lastGoodReadAt: "2026-11-18T00:00:00Z",
					failuresInARow: 3,
					failingSince: "2026-11-18T00:15:00Z",
					lastError: "OpenXBL API error: 500",
				},
			}),
			NOW,
		);

		expect(report.headline).toBe("Xbox needs attention.");
		expect(report.trouble).toBe(true);
		expect(report.rows[1]).toMatchObject({
			name: "Xbox",
			state: "Failing since 18 Nov 11:15",
			trouble: true,
			failedRuns: 3,
			detail: "OpenXBL API error: 500",
		});
	});

	it("gives the fix for a rejected token", () => {
		const report = healthReport(
			statusWith({
				psn: { failuresInARow: 1, rejected: true, failingSince: "x" },
			}),
			NOW,
		);

		expect(report.rows[2]).toMatchObject({
			state: "PSN NPSSO rejected",
			trouble: true,
		});
		expect(report.rows[2]?.fix).toMatch(/^Sign in at playstation\.com/);
	});

	it("counts the sources when more than one needs attention", () => {
		const old: SourceHealth = {
			lastGoodReadAt: "2026-11-17T20:00:00Z",
			failuresInARow: 0,
		};
		const report = healthReport(statusWith({ steam: old, trakt: old }), NOW);

		expect(report.headline).toBe("2 sources need attention.");
		expect(report.rows[0]).toMatchObject({ state: "Stale", trouble: true });
	});

	it("shows when a token expires and flags one that is close", () => {
		// 60 days after 1 Nov is 31 Dec: 43 days away
		const far = healthReport(statusWith({}), NOW);
		expect(far.rows[2]).toMatchObject({
			token: "PSN NPSSO",
			expires: "31 Dec 2026, in 43 days",
			expiresSoon: false,
		});
		expect(far.rows[5]).toMatchObject({
			token: "Trakt client id",
			expires: "No expiry",
		});

		// 60 days after 25 Sep is 24 Nov: 6 days away
		const near = healthReport(statusWith({}, "2026-09-25"), NOW);
		expect(near.rows[2]).toMatchObject({
			expires: "24 Nov 2026, in 6 days",
			expiresSoon: true,
		});
		expect(near.headline).toBe("PSN needs attention.");
	});

	it("says no refresh has run when there is no bookkeeping", () => {
		const report = healthReport(null, NOW);

		expect(report.headline).toBe("No refresh has run yet.");
		expect(report.trouble).toBe(true);
		expect(report.lastRefresh).toBe("never");
	});
});
