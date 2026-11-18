import { describe, expect, it } from "vitest";
import { statusStripView } from "./strip";

const NOW = new Date("2026-11-18T01:00:00Z"); // midday in Sydney

describe("statusStripView", () => {
	it("shows each source's last good read, marked Stale where it applies", () => {
		const view = statusStripView(
			{
				lastSuccessAt: "2026-11-18T00:45:00Z",
				sources: {
					steam: { lastGoodReadAt: "2026-11-18T00:30:00Z", failuresInARow: 0 },
					xbox: {
						lastGoodReadAt: "2026-11-17T20:00:00Z",
						failuresInARow: 12,
						lastError: "OpenXBL API error: 500",
					},
				},
			},
			null,
			NOW,
		);

		expect(view.sources.slice(0, 3)).toEqual([
			{ name: "Steam", lastGoodRead: "18 Nov 11:30", stale: false },
			{ name: "Xbox", lastGoodRead: "18 Nov 07:00", stale: true },
			{ name: "PSN", lastGoodRead: "never", stale: true },
		]);
		expect(view.sources.map((source) => source.name)).toEqual([
			"Steam",
			"Xbox",
			"PSN",
			"Switch",
			"Letterboxd",
			"Trakt",
			"TMDB",
			"IGDB",
		]);
		expect(view.lastRefresh).toBe("18 Nov 11:45");
		expect(view.lastAlert).toBeNull();
	});

	it("shows the last Alert and whether the send succeeded", () => {
		const view = statusStripView(
			null,
			{
				label: "PSN",
				at: "2026-11-17T22:00:00Z",
				ok: false,
				error: "Telegram answered 502",
			},
			NOW,
		);

		expect(view.lastRefresh).toBe("never");
		expect(view.lastAlert).toEqual({
			label: "PSN",
			at: "18 Nov 09:00",
			sent: false,
		});
	});
});
