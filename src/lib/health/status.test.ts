import { describe, expect, it } from "vitest";
import {
	isStale,
	type RefreshStatus,
	type RunReads,
	updateStatus,
} from "./status";

const T0 = new Date("2026-11-18T01:00:00Z");
const T1 = new Date("2026-11-18T01:15:00Z");
const NPSSO = { fingerprint: "aaaa" };

function run(reads: RunReads, at: Date, previous: RefreshStatus | null = null) {
	return updateStatus(previous, { reads, npsso: NPSSO }, at);
}

describe("updateStatus", () => {
	it("records the refresh's last success and each source's last good read", () => {
		const status = run({ steam: { good: 1, failed: 0 } }, T0);

		expect(status.lastSuccessAt).toBe(T0.toISOString());
		expect(status.sources.steam).toEqual({
			lastGoodReadAt: T0.toISOString(),
			failuresInARow: 0,
		});
	});

	it("leaves a source alone on a run that did not read it", () => {
		const first = run({ steam: { good: 1, failed: 0 } }, T0);
		const second = run({}, T1, first);

		expect(second.lastSuccessAt).toBe(T1.toISOString());
		expect(second.sources.steam?.lastGoodReadAt).toBe(T0.toISOString());
	});

	it("counts failed runs in a row and keeps the last good read", () => {
		const failed = {
			xbox: { good: 0, failed: 1, error: "OpenXBL API error: 500" },
		};
		const first = run({ xbox: { good: 1, failed: 0 } }, T0);
		const second = run(failed, T1, first);
		const third = run(failed, new Date("2026-11-18T01:30:00Z"), second);

		expect(third.sources.xbox).toEqual({
			lastGoodReadAt: T0.toISOString(),
			failuresInARow: 2,
			failingSince: T1.toISOString(),
			lastError: "OpenXBL API error: 500",
		});
	});

	it("counts a run as good when any read of the source worked", () => {
		// One show Trakt cannot answer for must not make Trakt Stale
		const status = run({ trakt: { good: 3, failed: 1, error: "404" } }, T0);

		expect(status.sources.trakt).toEqual({
			lastGoodReadAt: T0.toISOString(),
			failuresInARow: 0,
		});
	});

	it("keeps a token rejected while the source goes on failing another way", () => {
		const rejected = run({ psn: { good: 0, failed: 1, rejected: true } }, T0);
		const timedOut = run({ psn: { good: 0, failed: 1 } }, T1, rejected);

		expect(timedOut.sources.psn?.rejected).toBe(true);
		expect(timedOut.sources.psn?.failuresInARow).toBe(2);
	});

	it("takes the day a token first seen was set from what was known before", () => {
		const status = updateStatus(
			null,
			{ reads: {}, npsso: { fingerprint: "aaaa", knownSince: "2026-10-30" } },
			T0,
		);

		expect(status.npsso?.changedOn).toBe("2026-10-30");
	});

	it("clears the failure when the source is read again", () => {
		const failing = run({ xbox: { good: 0, failed: 1 } }, T0);
		const recovered = run({ xbox: { good: 1, failed: 0 } }, T1, failing);

		expect(recovered.sources.xbox).toEqual({
			lastGoodReadAt: T1.toISOString(),
			failuresInARow: 0,
		});
	});

	it("marks a source whose token was rejected", () => {
		const status = run({ psn: { good: 0, failed: 1, rejected: true } }, T0);

		expect(status.sources.psn?.rejected).toBe(true);
	});

	it("records the owner's day the PSN token's fingerprint changes", () => {
		// 01:00 UTC on the 18th is midday on the 18th in Sydney
		const first = run({}, T0);
		const sameToken = run({}, new Date("2026-12-01T01:00:00Z"), first);
		const newToken = updateStatus(
			sameToken,
			{ reads: {}, npsso: { fingerprint: "bbbb" } },
			new Date("2026-12-20T20:00:00Z"),
		);

		expect(first.npsso).toEqual({
			fingerprint: "aaaa",
			changedOn: "2026-11-18",
		});
		expect(sameToken.npsso).toEqual(first.npsso);
		// 20:00 UTC on the 20th is already the 21st in Sydney
		expect(newToken.npsso).toEqual({
			fingerprint: "bbbb",
			changedOn: "2026-12-21",
		});
	});
});

describe("isStale", () => {
	const at = (hoursAgo: number): string =>
		new Date(T0.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();

	it("is Stale when a Source's last good read is more than two hours old", () => {
		expect(
			isStale("steam", { lastGoodReadAt: at(1), failuresInARow: 0 }, T0),
		).toBe(false);
		expect(
			isStale("steam", { lastGoodReadAt: at(3), failuresInARow: 0 }, T0),
		).toBe(true);
	});

	it("is Stale when a Source has never been read", () => {
		expect(isStale("steam", undefined, T0)).toBe(true);
	});

	it("is Stale for a Catalog only while its reads are failing", () => {
		expect(
			isStale("tmdb", { lastGoodReadAt: at(72), failuresInARow: 0 }, T0),
		).toBe(false);
		expect(
			isStale("tmdb", { lastGoodReadAt: at(72), failuresInARow: 2 }, T0),
		).toBe(true);
		expect(isStale("tmdb", undefined, T0)).toBe(false);
	});
});
