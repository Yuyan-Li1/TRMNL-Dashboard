import { fingerprint } from "@/lib/health/status";
import { addDays, ownerDay } from "@/lib/owner-day";
import type { Database } from "./db";

const TOKEN_NAME = "claude-code";

/** A Claude Code token from `claude setup-token` lasts one year. */
const LIFETIME_DAYS = 365;

/**
 * The day (`YYYY-MM-DD`) the Claude Code token expires: one year after the
 * day the Collector first saw its fingerprint or saw it change. Undefined
 * when no token is set.
 */
export function claudeTokenExpiry(
	db: Database,
	token: string | undefined,
	now: Date,
): string | undefined {
	if (!token) {
		return undefined;
	}
	const seen = fingerprint(token);
	const stored = db
		.prepare("SELECT fingerprint, changed_on FROM tokens WHERE name = ?")
		.get(TOKEN_NAME) as { fingerprint: string; changed_on: string } | undefined;
	if (stored?.fingerprint === seen) {
		return addDays(stored.changed_on, LIFETIME_DAYS);
	}
	const changedOn = ownerDay(now);
	db.prepare(
		`INSERT INTO tokens (name, fingerprint, changed_on) VALUES (?, ?, ?)
		 ON CONFLICT (name) DO UPDATE SET fingerprint = excluded.fingerprint,
		 changed_on = excluded.changed_on`,
	).run(TOKEN_NAME, seen, changedOn);
	return addDays(changedOn, LIFETIME_DAYS);
}
