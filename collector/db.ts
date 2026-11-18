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
	CREATE TABLE IF NOT EXISTS books (
		review_id TEXT PRIMARY KEY,
		book_id TEXT,
		title TEXT NOT NULL,
		author TEXT,
		cover_url TEXT,
		stars INTEGER,
		shelf TEXT NOT NULL,
		-- Where the book stood on its shelf at the last read; NULL once a
		-- read book has dropped out of the newest hundred
		position INTEGER,
		-- The day the book was first seen as read; NULL for a book already
		-- read when the Collector first ran
		first_read_on TEXT
	);
	CREATE TABLE IF NOT EXISTS book_progress (
		book_id TEXT PRIMARY KEY,
		page INTEGER,
		pages INTEGER,
		percent INTEGER,
		at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS book_details (
		book_id TEXT PRIMARY KEY,
		description TEXT,
		average_rating REAL
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
