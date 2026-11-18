import { DatabaseSync } from "node:sqlite";

/**
 * The Collector's record. Everything it knows is here; Redis can be rebuilt
 * from it at any time.
 */
const SCHEMA = `
	CREATE TABLE IF NOT EXISTS jobs (
		name TEXT PRIMARY KEY,
		last_attempt_at TEXT,
		last_success_at TEXT,
		failures_in_a_row INTEGER NOT NULL DEFAULT 0,
		failing_since TEXT,
		last_error TEXT
	);
	CREATE TABLE IF NOT EXISTS alerts (
		id TEXT PRIMARY KEY,
		state TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS tokens (
		name TEXT PRIMARY KEY,
		fingerprint TEXT NOT NULL,
		changed_on TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS meta (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
`;

export type Database = DatabaseSync;

/** Open the record at a path (or `:memory:`), creating its tables. */
export function openDatabase(path: string): Database {
	const db = new DatabaseSync(path);
	db.exec(SCHEMA);
	return db;
}
