import { type ConsumedSet, consumedKey, nameKey } from "@/lib/consumed/set";
import { MEDIA, type Medium } from "@/lib/screen/types";
import type { HistorySource } from "@/types/history";
import { type Database, getMeta } from "../db";
import type { HomeRedis } from "../redis";
import { isSeeded } from "./seed";

/**
 * The sources each Medium's set is built from besides the exports. A set
 * published before one of them has been merged would be missing everything
 * that source records, and Vercel would recommend it.
 */
const SOURCES_NEEDED: Record<Medium, HistorySource[]> = {
	game: ["steam", "xbox", "psn", "switch"],
	movie: ["letterboxd"],
	// A series logged in the Letterboxd diary is a show
	show: ["trakt", "letterboxd"],
	book: [],
};

/** Where the record notes that a source's full history has been merged. */
export function mergedKey(source: HistorySource): string {
	return `consumed:merged:${source}`;
}

interface TitleRow {
	medium: Medium;
	catalog_id: string | null;
	title: string;
	author: string | null;
}

/**
 * The consumed set of each Medium that is ready to publish, built from the
 * record: what the sources and the exports record, the read shelf, and the
 * matched lines of the "also consumed" files. None until `collector seed`
 * has run, and a Medium's only once the full history of each of its sources
 * has been merged: a partial set would let Vercel recommend what the owner
 * has Consumed.
 */
export function consumedSets(
	db: Database,
	now: Date,
): Partial<Record<Medium, ConsumedSet>> {
	if (!isSeeded(db)) {
		return {};
	}
	const rows = db
		.prepare(
			`SELECT medium, CASE medium WHEN 'game' THEN catalog_id ELSE key END
			 AS catalog_id, title, author FROM consumed
			 UNION ALL
			 SELECT 'book', book_id, title, author FROM books WHERE shelf = 'read'
			 UNION ALL
			 SELECT medium, catalog_id, title, author FROM also_consumed
			 WHERE catalog_id IS NOT NULL`,
		)
		.all() as unknown as TitleRow[];

	const sets = Object.fromEntries(
		MEDIA.map((medium) => [
			medium,
			{ ids: new Set<string>(), names: new Set<string>() },
		]),
	) as Record<Medium, { ids: Set<string>; names: Set<string> }>;
	for (const row of rows) {
		const set = sets[row.medium];
		if (row.catalog_id) {
			set.ids.add(row.catalog_id);
		}
		const name = nameKey(row.medium, row.title, row.author ?? undefined);
		if (name) {
			set.names.add(name);
		}
	}

	const publishedAt = now.toISOString();
	return Object.fromEntries(
		MEDIA.filter((medium) =>
			SOURCES_NEEDED[medium].every(
				(source) => getMeta(db, mergedKey(source)) !== undefined,
			),
		).map((medium): [Medium, ConsumedSet] => [
			medium,
			{
				ids: [...sets[medium].ids],
				names: [...sets[medium].names],
				publishedAt,
			},
		]),
	);
}

/** Rewrite the `home:consumed:` keys from the record. */
export async function publishConsumed(
	db: Database,
	redis: HomeRedis,
	now: Date,
): Promise<void> {
	for (const [medium, set] of Object.entries(consumedSets(db, now))) {
		await redis.set(consumedKey(medium as Medium), set);
	}
}

/** A line of an "also consumed" file that no Catalog could match. */
export interface UnmatchedLine {
	medium: Medium;
	/** The line as written */
	line: string;
}

/** The lines of the "also consumed" files that no Catalog could match. */
export function unmatchedLines(db: Database): UnmatchedLine[] {
	return db
		.prepare(
			`SELECT medium, line FROM also_consumed WHERE catalog_id IS NULL
			 ORDER BY medium, line`,
		)
		.all() as unknown as UnmatchedLine[];
}
