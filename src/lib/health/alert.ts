import {
	type AlertState,
	type AlertStore,
	processChecks,
	type SendResult,
	type SentAlert,
} from "@/lib/alerts/alerts";
import { sendTelegramMessage } from "@/lib/alerts/telegram";
import { getRedis } from "@/lib/cache/redis";
import { OWNER_TIME_ZONE } from "@/lib/config";
import { healthChecks, SENDER } from "./checks";
import type { RefreshStatus } from "./status";

/** Per-failure Alert state. The one prefix the Collector also writes under. */
const ALERT_KEY_PREFIX = "alert:";
/** The last Alert Vercel tried to send, and whether Telegram took it */
const LAST_SEND_KEY = "telegram:last-send";

const redisStore: AlertStore = {
	get: (id) => getRedis().get<AlertState>(`${ALERT_KEY_PREFIX}${id}`),
	set: async (id, state) => {
		await getRedis().set(`${ALERT_KEY_PREFIX}${id}`, state);
	},
	delete: async (id) => {
		await getRedis().del(`${ALERT_KEY_PREFIX}${id}`);
	},
};

function send(text: string): Promise<SendResult> {
	return sendTelegramMessage(text, {
		botToken: process.env.TELEGRAM_BOT_TOKEN,
		chatId: process.env.TELEGRAM_CHAT_ID,
	});
}

/** The last Alert Vercel tried to send. */
export async function readLastSend(): Promise<SentAlert | null> {
	return getRedis().get<SentAlert>(LAST_SEND_KEY);
}

/**
 * Send the Alerts the refresh's bookkeeping calls for: failures that have
 * started, lasted another day or cleared, and tokens close to expiry.
 */
export async function sendAlerts(
	status: RefreshStatus,
	now: Date,
): Promise<SentAlert[]> {
	const alerts = await processChecks({
		sender: SENDER,
		checks: healthChecks(status, now),
		store: redisStore,
		send,
		now,
		timeZone: OWNER_TIME_ZONE,
	});
	// A send that failed is the one to show, so a later one that worked in
	// the same run does not hide it
	const last = alerts.find((alert) => !alert.ok) ?? alerts.at(-1);
	if (last) {
		await getRedis().set(LAST_SEND_KEY, last);
	}
	return alerts;
}

/** Send a test Alert, to show that Telegram reaches the owner. */
export async function sendTestAlert(): Promise<SentAlert> {
	const result = await send(
		`[${SENDER}] Test Alert from the source health page.`,
	);
	const alert: SentAlert = {
		label: "Test",
		at: new Date().toISOString(),
		ok: result.ok,
	};
	if (result.error) {
		alert.error = result.error;
	}
	await getRedis().set(LAST_SEND_KEY, alert);
	return alert;
}

/**
 * Tell the owner Redis cannot be reached. With no Redis there is no state to
 * hold repeats back, so the refresh calls this at most once.
 */
export async function alertRedisUnreachable(): Promise<void> {
	const result = await send(`[${SENDER}] Redis unreachable.`);
	if (!result.ok) {
		console.error("Redis unreachable Alert not sent:", result.error);
	}
}
