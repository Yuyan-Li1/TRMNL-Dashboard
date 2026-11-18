import type { AlertState, AlertStore } from "@/lib/alerts/alerts";
import type { Database } from "./db";
import type { HomeRedis } from "./redis";

/** Per-failure Alert state, the one prefix both sides write under. */
const ALERT_KEY_PREFIX = "alert:";

/**
 * The Collector's Alert state. SQLite is the record, so repeats are held
 * back even when Redis cannot be reached; each change is copied to Redis
 * where that works.
 */
export function alertStore(db: Database, redis: HomeRedis): AlertStore {
	async function mirror(write: () => Promise<void>): Promise<void> {
		try {
			await write();
		} catch {
			// The record has it; Redis is only a copy
		}
	}
	return {
		get: async (id) => {
			const row = db
				.prepare("SELECT state FROM alerts WHERE id = ?")
				.get(id) as { state: string } | undefined;
			return row ? (JSON.parse(row.state) as AlertState) : null;
		},
		set: async (id, state) => {
			db.prepare(
				`INSERT INTO alerts (id, state) VALUES (?, ?)
				 ON CONFLICT (id) DO UPDATE SET state = excluded.state`,
			).run(id, JSON.stringify(state));
			await mirror(() => redis.set(`${ALERT_KEY_PREFIX}${id}`, state));
		},
		delete: async (id) => {
			db.prepare("DELETE FROM alerts WHERE id = ?").run(id);
			await mirror(() => redis.del(`${ALERT_KEY_PREFIX}${id}`));
		},
	};
}
