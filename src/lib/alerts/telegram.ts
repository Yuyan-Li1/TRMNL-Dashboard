import type { SendResult } from "./alerts";

const TELEGRAM_URL = "https://api.telegram.org";
const SEND_TIMEOUT_MS = 10_000;

export interface TelegramConfig {
	/** The bot's token from BotFather */
	botToken?: string;
	/** The owner's private chat with the bot */
	chatId?: string;
}

/**
 * Send one message to the owner, with sound. Never throws: a failed send is
 * reported, so the caller can try again on its next run.
 */
export async function sendTelegramMessage(
	text: string,
	{ botToken, chatId }: TelegramConfig,
): Promise<SendResult> {
	if (!botToken || !chatId) {
		return {
			ok: false,
			error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured",
		};
	}

	try {
		const response = await fetch(`${TELEGRAM_URL}/bot${botToken}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text }),
			signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
		});
		if (response.ok) {
			return { ok: true };
		}
		const body = (await response.json().catch(() => null)) as {
			description?: string;
		} | null;
		// The URL carries the token, so it is kept out of the message
		return {
			ok: false,
			error: `Telegram answered ${response.status}${body?.description ? `: ${body.description}` : ""}`,
		};
	} catch (error) {
		const name = error instanceof Error ? error.name : "Error";
		return { ok: false, error: `Telegram could not be reached (${name})` };
	}
}
