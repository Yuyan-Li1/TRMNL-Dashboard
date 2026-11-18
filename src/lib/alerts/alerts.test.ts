import { describe, expect, it } from "vitest";
import {
	type AlertState,
	type AlertStore,
	type Check,
	processChecks,
	type SendResult,
} from "./alerts";

const START = new Date("2026-11-18T01:00:00Z"); // midday in Sydney

function hoursLater(hours: number): Date {
	return new Date(START.getTime() + hours * 60 * 60 * 1000);
}

/** A sender and a store that remember what happened across runs. */
function setup() {
	const states = new Map<string, AlertState>();
	const sent: string[] = [];
	let telegramUp = true;
	const store: AlertStore = {
		get: async (id) => states.get(id) ?? null,
		set: async (id, state) => void states.set(id, state),
		delete: async (id) => void states.delete(id),
	};
	const send = async (text: string): Promise<SendResult> => {
		if (!telegramUp) {
			return { ok: false, error: "Telegram answered 502" };
		}
		sent.push(text);
		return { ok: true };
	};
	return {
		sent,
		states,
		setTelegramUp: (up: boolean) => {
			telegramUp = up;
		},
		run: (checks: Check[], now: Date) =>
			processChecks({
				sender: "vercel",
				checks,
				store,
				send,
				now,
				timeZone: "Australia/Sydney",
			}),
	};
}

const PSN_REJECTED: Check = {
	id: "vercel:psn",
	label: "PSN",
	failure: {
		what: "PSN NPSSO rejected",
		fix: "copy a new npsso into PSN_NPSSO.",
	},
};
const PSN_FINE: Check = { id: "vercel:psn", label: "PSN", failure: null };

describe("processChecks", () => {
	it("sends one message when a failure starts: sender, what, since when, fix", async () => {
		const { run, sent } = setup();

		const alerts = await run([PSN_REJECTED], START);

		expect(sent).toEqual([
			"[vercel] PSN NPSSO rejected since 18 Nov 12:00.\nFix: copy a new npsso into PSN_NPSSO.",
		]);
		expect(alerts).toEqual([
			{ label: "PSN", at: START.toISOString(), ok: true },
		]);
	});

	it("dates the failure from when it began, where the check knows", async () => {
		const { run, sent } = setup();

		await run(
			[
				{
					id: "vercel:steam",
					label: "Steam",
					failure: {
						what: "Steam read failing",
						since: "2026-11-18T00:15:00Z",
					},
				},
			],
			START,
		);

		expect(sent).toEqual(["[vercel] Steam read failing since 18 Nov 11:15."]);
	});

	it("stays silent while the failure lasts, until 24 hours have passed", async () => {
		const { run, sent } = setup();
		await run([PSN_REJECTED], START);

		await run([PSN_REJECTED], hoursLater(0.25));
		await run([PSN_REJECTED], hoursLater(23.75));

		expect(sent).toHaveLength(1);
	});

	it("reminds every 24 hours, with how long the failure has lasted", async () => {
		const { run, sent } = setup();
		await run([PSN_REJECTED], START);

		await run([PSN_REJECTED], hoursLater(24));
		await run([PSN_REJECTED], hoursLater(36));
		await run([PSN_REJECTED], hoursLater(48));

		expect(sent.slice(1)).toEqual([
			"[vercel] PSN NPSSO rejected since 18 Nov 12:00, for 1 day.\nFix: copy a new npsso into PSN_NPSSO.",
			"[vercel] PSN NPSSO rejected since 18 Nov 12:00, for 2 days.\nFix: copy a new npsso into PSN_NPSSO.",
		]);
	});

	it("sends one line when the failure clears, and nothing after", async () => {
		const { run, sent } = setup();
		await run([PSN_REJECTED], START);

		await run([PSN_FINE], hoursLater(50));
		await run([PSN_FINE], hoursLater(51));

		expect(sent.slice(1)).toEqual(["[vercel] PSN recovered after 2 days"]);
	});

	it.each([
		[0.5, "30 minutes"],
		[1, "1 hour"],
		[5.5, "5 hours"],
		[24, "1 day"],
	])("recovery after %s hours says %s", async (hours, duration) => {
		const { run, sent } = setup();
		await run([PSN_REJECTED], START);

		await run([PSN_FINE], hoursLater(hours));

		expect(sent[1]).toBe(`[vercel] PSN recovered after ${duration}`);
	});

	it("says nothing about a check that has never failed", async () => {
		const { run, sent } = setup();

		expect(await run([PSN_FINE], START)).toEqual([]);
		expect(sent).toEqual([]);
	});

	it("retries on the next run a message Telegram did not take", async () => {
		const { run, sent, setTelegramUp } = setup();
		setTelegramUp(false);

		const failed = await run([PSN_REJECTED], START);
		setTelegramUp(true);
		await run([PSN_REJECTED], hoursLater(0.25));
		await run([PSN_REJECTED], hoursLater(0.5));

		expect(failed).toEqual([
			{
				label: "PSN",
				at: START.toISOString(),
				ok: false,
				error: "Telegram answered 502",
			},
		]);
		expect(sent).toEqual([
			"[vercel] PSN NPSSO rejected since 18 Nov 12:00.\nFix: copy a new npsso into PSN_NPSSO.",
		]);
	});

	it("retries a recovery message Telegram did not take", async () => {
		const { run, sent, setTelegramUp } = setup();
		await run([PSN_REJECTED], START);

		setTelegramUp(false);
		await run([PSN_FINE], hoursLater(2));
		setTelegramUp(true);
		await run([PSN_FINE], hoursLater(2.25));
		await run([PSN_FINE], hoursLater(2.5));

		expect(sent.slice(1)).toEqual(["[vercel] PSN recovered after 2 hours"]);
	});

	it("does not announce the recovery of a failure the owner never heard of", async () => {
		const { run, sent, setTelegramUp } = setup();
		setTelegramUp(false);
		await run([PSN_REJECTED], START);
		setTelegramUp(true);

		await run([PSN_FINE], hoursLater(0.25));

		expect(sent).toEqual([]);
	});

	it("sends again at once when what failed changes", async () => {
		const { run, sent } = setup();
		const readFailing: Check = {
			...PSN_REJECTED,
			failure: { what: "PSN read failing" },
		};
		await run([readFailing], START);

		await run([PSN_REJECTED], hoursLater(1));

		expect(sent[1]).toBe(
			"[vercel] PSN NPSSO rejected since 18 Nov 12:00.\nFix: copy a new npsso into PSN_NPSSO.",
		);
	});

	it("sends a one-off warning once per wording, with no reminder and no recovery", async () => {
		const { run, sent, states } = setup();
		const warning = (days: number): Check => ({
			id: "vercel:psn-expiry",
			label: "PSN NPSSO",
			oneOff: true,
			failure: {
				what: `PSN NPSSO expires within ${days} days, on 17 Jan 2027`,
			},
		});

		await run([warning(14)], START);
		await run([warning(14)], hoursLater(48));
		await run([warning(3)], hoursLater(11 * 24));
		await run([{ ...warning(3), failure: null }], hoursLater(12 * 24));

		expect(sent).toEqual([
			"[vercel] PSN NPSSO expires within 14 days, on 17 Jan 2027.",
			"[vercel] PSN NPSSO expires within 3 days, on 17 Jan 2027.",
		]);
		expect(states.size).toBe(0);
	});
});
