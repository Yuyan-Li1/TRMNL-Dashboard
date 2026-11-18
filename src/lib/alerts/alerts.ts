/**
 * The Alert rules: one message when a failure starts, a reminder every 24
 * hours while it lasts, one line when it clears. Shared by Vercel and the
 * Collector, so this folder imports nothing from the rest of the dashboard:
 * the sender's name, the store and the way to send are passed in.
 */
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const REMINDER_EVERY_MS = DAY_MS;

/** One thing that can fail, as seen on this run. */
export interface Check {
	/** Names the failure's state in the store, such as `vercel:psn` */
	id: string;
	/** What recovers: "PSN" in "PSN recovered after 2 days" */
	label: string;
	/** Null when the check passes */
	failure: {
		/** What failed, such as "PSN NPSSO rejected" */
		what: string;
		/** When it began, where the check knows; otherwise this run */
		since?: string;
		/** One line on how to fix it, where there is one */
		fix?: string;
	} | null;
	/**
	 * An Alert sent once per wording, with no reminder and no recovery
	 * message: a token close to expiry.
	 */
	oneOff?: boolean;
}

/** What is remembered of a failure between runs. */
export interface AlertState {
	what: string;
	since: string;
	/** When the owner was last told; null until a message gets through */
	sentAt: string | null;
	/** The failure has cleared and the recovery message is still owed */
	recovered?: boolean;
}

export interface AlertStore {
	get(id: string): Promise<AlertState | null>;
	set(id: string, state: AlertState): Promise<void>;
	delete(id: string): Promise<void>;
}

export interface SendResult {
	ok: boolean;
	error?: string;
}

/** An Alert this run tried to send. */
export interface SentAlert {
	label: string;
	at: string;
	ok: boolean;
	error?: string;
}

export interface ProcessChecksOptions {
	/** Who is speaking: `vercel` or `home` */
	sender: string;
	checks: Check[];
	store: AlertStore;
	send: (text: string) => Promise<SendResult>;
	now: Date;
	/** The zone the "since" time is written in */
	timeZone: string;
}

function plural(count: number, unit: string): string {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** How long a failure has lasted: "45 minutes", "5 hours", "2 days". */
export function formatDuration(ms: number): string {
	if (ms < HOUR_MS) return plural(Math.floor(ms / MINUTE_MS), "minute");
	if (ms < DAY_MS) return plural(Math.floor(ms / HOUR_MS), "hour");
	return plural(Math.floor(ms / DAY_MS), "day");
}

/** A moment as "18 Nov 12:00" in a time zone. */
export function formatMoment(at: string | Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(at));
	const part = (type: string): string =>
		parts.find((entry) => entry.type === type)?.value ?? "";
	return `${part("day")} ${part("month")} ${part("hour")}:${part("minute")}`;
}

/**
 * Compare each check with what was remembered of it and send what is due.
 * A message Telegram does not take is sent again on the next run.
 */
export async function processChecks({
	sender,
	checks,
	store,
	send,
	now,
	timeZone,
}: ProcessChecksOptions): Promise<SentAlert[]> {
	const at = now.toISOString();
	const alerts: SentAlert[] = [];

	async function sendAlert(label: string, text: string): Promise<boolean> {
		const result = await send(`[${sender}] ${text}`);
		const alert: SentAlert = { label, at, ok: result.ok };
		if (result.error) {
			alert.error = result.error;
		}
		alerts.push(alert);
		return result.ok;
	}

	for (const check of checks) {
		const stored = await store.get(check.id);
		const { failure } = check;

		if (!failure) {
			if (!stored) {
				continue;
			}
			// A failure the owner was never told of clears without a word
			const owed = !check.oneOff && stored.sentAt !== null;
			const lasted = now.getTime() - new Date(stored.since).getTime();
			if (
				!owed ||
				(await sendAlert(
					check.label,
					`${check.label} recovered after ${formatDuration(lasted)}`,
				))
			) {
				await store.delete(check.id);
			} else if (!stored.recovered) {
				await store.set(check.id, { ...stored, recovered: true });
			}
			continue;
		}

		// A failure that comes back before its recovery was sent starts afresh
		const known = stored && !stored.recovered ? stored : null;
		const since = known?.since ?? failure.since ?? at;
		const told = known?.sentAt != null && known.what === failure.what;
		const reminderDue =
			told &&
			!check.oneOff &&
			now.getTime() - new Date(known.sentAt as string).getTime() >=
				REMINDER_EVERY_MS;
		if (told && !reminderDue) {
			continue;
		}

		let text = failure.what;
		if (!check.oneOff) {
			text += ` since ${formatMoment(since, timeZone)}`;
		}
		if (reminderDue) {
			const lasted = now.getTime() - new Date(since).getTime();
			text += `, for ${formatDuration(lasted)}`;
		}
		text += ".";
		if (failure.fix) {
			text += `\nFix: ${failure.fix}`;
		}

		const ok = await sendAlert(check.label, text);
		await store.set(check.id, {
			what: failure.what,
			since,
			// A reminder that fails keeps the old time, so it is tried again
			sentAt: ok ? at : reminderDue ? (known?.sentAt ?? null) : null,
		});
	}

	return alerts;
}
