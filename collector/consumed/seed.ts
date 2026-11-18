import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "../csv";
import { type Database, getMeta, setMeta, transaction } from "../db";

/** Set once `collector seed` has loaded the exports. */
const SEEDED_KEY = "consumed:seeded";

/** One film in `letterboxd-tmdb-map.json`. */
interface MappedFilm {
	uri?: string;
	tmdbId?: number;
	/** `movie`, or `tv` for a series logged on Letterboxd */
	tmdbType?: string | null;
}

/** Whether the exports have been loaded. Nothing is published before. */
export function isSeeded(db: Database): boolean {
	return getMeta(db, SEEDED_KEY) !== undefined;
}

function read(file: string): string {
	try {
		return readFileSync(file, "utf8");
	} catch {
		throw new Error(`${file} is missing: copy the exports there first`);
	}
}

/**
 * `collector seed`: load the owner's one-off exports into the record. The
 * Letterboxd export's films are matched to TMDB ids by the map made from
 * their film pages; the Goodreads export's read books carry their own ids. A
 * did-not-finish book is not Consumed. Safe to run twice: a title already in
 * the record is left as it is. Fails, loading nothing, when a film has no id
 * in the map.
 */
export function seedConsumed(
	db: Database,
	exportsDir: string,
	now: Date,
): { movies: number; books: number } {
	const watched = parseCsv(
		read(path.join(exportsDir, "letterboxd", "watched.csv")),
	);
	const mapped = new Map(
		(
			JSON.parse(
				read(path.join(exportsDir, "letterboxd-tmdb-map.json")),
			) as MappedFilm[]
		).map((film) => [film.uri, film]),
	);
	const books = parseCsv(
		read(path.join(exportsDir, "goodreads_library_export.csv")),
	).filter((book) => book["Exclusive Shelf"] === "read" && book["Book Id"]);

	const unmapped = watched.filter(
		(film) => !mapped.get(film["Letterboxd URI"])?.tmdbId,
	);
	if (unmapped.length > 0) {
		throw new Error(
			`No TMDB id in letterboxd-tmdb-map.json for: ${unmapped
				.map((film) => `${film.Name} (${film.Year})`)
				.join("; ")}`,
		);
	}

	const insert = db.prepare(
		`INSERT INTO consumed (medium, key, title, author, source)
		 VALUES (?, ?, ?, ?, ?) ON CONFLICT (medium, key) DO NOTHING`,
	);
	transaction(db, () => {
		for (const film of watched) {
			const { tmdbId, tmdbType } = mapped.get(film["Letterboxd URI"]) ?? {};
			insert.run(
				tmdbType === "tv" ? "show" : "movie",
				String(tmdbId),
				film.Name,
				null,
				"letterboxd-export",
			);
		}
		for (const book of books) {
			insert.run(
				"book",
				book["Book Id"],
				book.Title,
				book.Author || null,
				"goodreads-export",
			);
		}
		setMeta(db, SEEDED_KEY, now.toISOString());
	});
	return { movies: watched.length, books: books.length };
}
