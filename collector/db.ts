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
	-- Every title the owner has Consumed that a source or an export records.
	-- Read books are not copied here: they are in books already
	CREATE TABLE IF NOT EXISTS consumed (
		medium TEXT NOT NULL,
		-- What its source knows the title by: a movie's or show's TMDB id, a
		-- book's Goodreads id, the matching form of a game's name
		key TEXT NOT NULL,
		title TEXT NOT NULL,
		author TEXT,
		steam_app_id TEXT,
		-- A game's IGDB id; NULL until it is looked up, and when IGDB has
		-- no match. Movies, shows and books are their own Catalog id
		catalog_id TEXT,
		-- When IGDB was asked about a game, match or not
		looked_up_at TEXT,
		-- Where it was first seen: a source or an export
		source TEXT NOT NULL,
		PRIMARY KEY (medium, key)
	);
	-- Each line of the "also consumed" files, looked up once
	CREATE TABLE IF NOT EXISTS also_consumed (
		medium TEXT NOT NULL,
		line TEXT NOT NULL,
		-- NULL when the Catalog had no match for the line
		catalog_id TEXT,
		title TEXT,
		author TEXT,
		PRIMARY KEY (medium, line)
	);
	-- The owner's text files as last read, so that a snapshot holds them
	CREATE TABLE IF NOT EXISTS files (
		path TEXT PRIMARY KEY,
		content TEXT NOT NULL
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

/** A value the record keeps by name, where it has one. */
export function getMeta(db: Database, key: string): string | undefined {
	const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
	return row?.value as string | undefined;
}

export function setMeta(db: Database, key: string, value: string): void {
	db.prepare(
		`INSERT INTO meta (key, value) VALUES (?, ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
	).run(key, value);
}

/** Run a change as one transaction: all of it or none. */
export function transaction<T>(db: Database, change: () => T): T {
	db.exec("BEGIN");
	try {
		const result = change();
		db.exec("COMMIT");
		return result;
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}
