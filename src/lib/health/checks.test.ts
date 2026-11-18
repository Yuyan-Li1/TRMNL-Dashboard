import { describe, expect, it } from "vitest";
import { healthChecks, tokenExpiry } from "./checks";
import type { RefreshStatus, SourceHealth } from "./status";

const NOW = new Date("2026-11-18T01:00:00Z"); // the 18th in Sydney
const FAILING_SINCE = "2026-11-18T00:15:00Z";

function status(overrides: Partial<RefreshStatus> = {}): RefreshStatus {
	return { lastSuccessAt: NOW.toISOString(), sources: {}, ...overrides };
}

function failing(
	runs: number,
	extra: Partial<SourceHealth> = {},
): SourceHealth {
	return { failuresInARow: runs, failingSince: FAILING_SINCE, ...extra };
}

function check(id: string, from: RefreshStatus, now = NOW) {
	return healthChecks(from, now).find((entry) => entry.id === id);
}

describe("healthChecks", () => {
	it("checks every source and Catalog, and both dated tokens", () => {
		expect(healthChecks(status(), NOW).map((entry) => entry.id)).toEqual([
			"vercel:steam",
			"vercel:xbox",
			"vercel:psn",
			"vercel:switch",
			"vercel:letterboxd",
			"vercel:trakt",
			"vercel:tmdb",
			"vercel:igdb",
			"vercel:psn-expiry",
			"vercel:nintendo-expiry",
		]);
	});

	it("keeps a source silent for three failed runs in a row", () => {
		const steam = check(
			"vercel:steam",
			status({ sources: { steam: failing(3) } }),
		);

		expect(steam).toEqual({
			id: "vercel:steam",
			label: "Steam",
			failure: null,
		});
	});

	it("fails a source at four failed runs in a row, since the first", () => {
		const tmdb = check(
			"vercel:tmdb",
			status({ sources: { tmdb: failing(4) } }),
		);

		expect(tmdb?.failure).toEqual({
			what: "TMDB read failing",
			since: FAILING_SINCE,
		});
	});

	it("fails a rejected token on the first run, with its fix", () => {
		const psn = check(
			"vercel:psn",
			status({ sources: { psn: failing(1, { rejected: true }) } }),
		);

		expect(psn?.failure?.what).toBe("PSN NPSSO rejected");
		expect(psn?.failure?.since).toBe(FAILING_SINCE);
		expect(psn?.failure?.fix).toContain("PSN_NPSSO");
	});

	it("dates the PSN token's expiry 60 days after its fingerprint changed", () => {
		const from = status({
			npsso: { fingerprint: "aaaa", changedOn: "2026-11-18" },
		});

		expect(tokenExpiry("psn", from)).toBe("2027-01-17");
		expect(tokenExpiry("switch", from)).toBe("2028-11-16");
		expect(tokenExpiry("trakt", from)).toBeUndefined();
		expect(tokenExpiry("psn", status())).toBeUndefined();
	});

	it.each([
		["2027-01-02T01:00:00Z", null], // 15 days before
		[
			"2027-01-03T01:00:00Z",
			"PSN NPSSO expires within 14 days, on 17 Jan 2027",
		],
		[
			"2027-01-13T01:00:00Z",
			"PSN NPSSO expires within 14 days, on 17 Jan 2027",
		],
		["2027-01-14T01:00:00Z", "PSN NPSSO expires within 3 days, on 17 Jan 2027"],
		["2027-01-20T01:00:00Z", "PSN NPSSO expires within 3 days, on 17 Jan 2027"],
	])("on %s the PSN expiry Alert is %s", (now, what) => {
		const expiry = check(
			"vercel:psn-expiry",
			status({ npsso: { fingerprint: "aaaa", changedOn: "2026-11-18" } }),
			new Date(now),
		);

		expect(expiry?.oneOff).toBe(true);
		// The label is shown on the public status strip: no token names
		expect(expiry?.label).toBe("PSN");
		expect(expiry?.failure?.what ?? null).toBe(what);
	});

	it("alerts before the Nintendo session token's fixed expiry day", () => {
		const expiry = check(
			"vercel:nintendo-expiry",
			status(),
			new Date("2028-11-05T01:00:00Z"),
		);

		expect(expiry?.failure?.what).toBe(
			"Nintendo session token expires within 14 days, on 16 Nov 2028",
		);
	});
});
