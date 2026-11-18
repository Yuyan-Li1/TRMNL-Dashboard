import { type ConsumedSet, consumedKey, nameKey } from "@/lib/consumed/set";
import { MEDIA, type Medium } from "@/lib/screen/types";
import type { Database } from "../db";
import type { HomeRedis } from "../redis";
import { isSeeded } from "./seed";

interface TitleRow {
	medium: Medium;
	catalog_id: string | null;
	title: string;
	author: string | null;
}

/**
 * One consumed set per Medium, built from the record: what the sources and
 * the exports record, the read shelf, and the matched lines of the
 * "also consumed" files. Null until `collector seed` has run: a set without
 * the exports would let Vercel recommend most of what the owner has watched.
 */
export function consumedSets(
	db: Database,
	now: Date,
): Record<Medium, ConsumedSet> | null {
	if (!isSeeded(db)) {
		return null;
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
		MEDIA.map((medium): [Medium, ConsumedSet] => [
			medium,
			{
				ids: [...sets[medium].ids],
				names: [...sets[medium].names],
				publishedAt,
			},
		]),
	) as Record<Medium, ConsumedSet>;
}

/** Rewrite the `home:consumed:` keys from the record. */
export async function publishConsumed(
	db: Database,
	redis: HomeRedis,
	now: Date,
): Promise<void> {
	const sets = consumedSets(db, now);
	if (!sets) {
		return;
	}
	for (const medium of MEDIA) {
		await redis.set(consumedKey(medium), sets[medium]);
	}
}

/** The lines of the "also consumed" files that no Catalog could match. */
export function unmatchedLines(
	db: Database,
): { medium: Medium; line: string }[] {
	return db
		.prepare(
			`SELECT medium, line FROM also_consumed WHERE catalog_id IS NULL
			 ORDER BY medium, line`,
		)
		.all() as unknown as { medium: Medium; line: string }[];
}
