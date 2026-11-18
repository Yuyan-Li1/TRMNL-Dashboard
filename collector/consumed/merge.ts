import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { GAME_CONSUMED_MINUTES, nameKey } from "@/lib/consumed/set";
import { MEDIA, type Medium } from "@/lib/screen/types";
import {
	type HistoryGame,
	type HistorySource,
	type HistoryTitle,
	historyKey,
	type SourceHistory,
} from "@/types/history";
import { type Database, setMeta, transaction } from "../db";
import type { Job } from "../jobs";
import type { HomeRedis } from "../redis";
import { mergedKey } from "./sets";

/**
 * The first merge has every game the owner ever played to look up, at
 * IGDB's 4 requests per second. They are spread over a few ticks.
 */
const GAME_LOOKUPS_PER_MERGE = 150;

const GAME_SOURCES = ["steam", "xbox", "psn", "switch"] as const;
/** The sources whose histories carry TMDB ids, and the Medium of each. */
const TMDB_SOURCES: Partial<Record<HistorySource, Medium>> = {
	letterboxd: "movie",
	trakt: "show",
};

/** What a Catalog is asked when a title is looked up by name. */
export interface CatalogQuery {
	title: string;
	year?: number;
	/** Books only */
	author?: string;
	/** Games only: Steam's id, which IGDB knows a game by */
	steamAppId?: string;
}

export interface CatalogMatch {
	id: string;
	/** The title as the Catalog has it */
	title: string;
	author?: string;
}

/**
 * Look a title up by name in its Medium's Catalog: IGDB for a game, Trakt
 * search for a movie or show, Goodreads for a book. Null when the Catalog
 * has no match; rejects when it could not be asked.
 */
export type FindInCatalog = (
	medium: Medium,
	query: CatalogQuery,
) => Promise<CatalogMatch | null>;

export interface ConsumedOptions {
	db: Database;
	redis: HomeRedis;
	/** The folder of the "also consumed" files, one `<medium>.txt` each */
	alsoConsumedDir: string;
	findInCatalog: FindInCatalog;
}

/**
 * Whether a game in a source's history keeps it out of Recommendations:
 * Consumed with 30 minutes or more of play or with any trophy or
 * achievement, and when the source records no play time for it (Xbox, a
 * PSN title only in the trophy list). A game in the Steam library is kept
 * out even if unplayed: the owner owns it.
 */
function isConsumedOrOwned(game: HistoryGame): boolean {
	return (
		game.owned === true ||
		game.minutesPlayed === undefined ||
		game.minutesPlayed >= GAME_CONSUMED_MINUTES ||
		(game.achievements ?? 0) > 0
	);
}

/** Add what Vercel's full-history keys hold to the record. Nothing leaves it. */
async function mergeHistories(
	db: Database,
	redis: HomeRedis,
	now: Date,
): Promise<void> {
	// The sources whose history Vercel has written: a Medium's set is not
	// published until every one of its sources has been merged once
	const merged: HistorySource[] = [];
	const games: { source: HistorySource; game: HistoryGame }[] = [];
	for (const source of GAME_SOURCES) {
		const history = await redis.get<SourceHistory<HistoryGame>>(
			historyKey(source),
		);
		if (history) {
			merged.push(source);
		}
		for (const game of history?.titles ?? []) {
			games.push({ source, game });
		}
	}
	const titles: { medium: Medium; source: string; title: HistoryTitle }[] = [];
	for (const [source, medium] of Object.entries(TMDB_SOURCES)) {
		const history = await redis.get<SourceHistory<HistoryTitle>>(
			historyKey(source as HistorySource),
		);
		if (history) {
			merged.push(source as HistorySource);
		}
		for (const title of history?.titles ?? []) {
			titles.push({ medium, source, title });
		}
	}

	transaction(db, () => {
		for (const source of merged) {
			setMeta(db, mergedKey(source), now.toISOString());
		}
		const insertGame = db.prepare(
			`INSERT INTO consumed (medium, key, title, steam_app_id, source)
			 VALUES ('game', ?, ?, ?, ?) ON CONFLICT (medium, key) DO UPDATE SET
			 steam_app_id = COALESCE(consumed.steam_app_id, excluded.steam_app_id)`,
		);
		for (const { source, game } of games) {
			const key = nameKey("game", game.name);
			if (key && isConsumedOrOwned(game)) {
				insertGame.run(key, game.name, game.steamAppId ?? null, source);
			}
		}
		const insertTitle = db.prepare(
			`INSERT INTO consumed (medium, key, title, source)
			 VALUES (?, ?, ?, ?) ON CONFLICT (medium, key) DO NOTHING`,
		);
		for (const { medium, source, title } of titles) {
			// A series in the Letterboxd diary is a show
			insertTitle.run(
				title.medium ?? medium,
				title.tmdbId,
				title.title,
				source,
			);
		}
	});
}

/** One line of an "also consumed" file. */
export interface AlsoConsumedLine extends CatalogQuery {
	/** The line as written, which names it in the record and in an Alert */
	line: string;
}

/**
 * The titles in an "also consumed" file: one per line, optionally followed
 * by a year in brackets, `Heat (1995)`, or for a book its author,
 * `Piranesi (Susanna Clarke)`. Blank lines and lines starting `#` are
 * skipped.
 */
export function parseAlsoConsumed(
	text: string,
	medium: Medium,
): AlsoConsumedLine[] {
	const lines = new Map<string, AlsoConsumedLine>();
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const entry: AlsoConsumedLine = { line, title: line };
		const bracketed = /^(.+?)\s*\(([^()]+)\)$/.exec(line);
		if (bracketed && /^\d{4}$/.test(bracketed[2])) {
			entry.title = bracketed[1];
			entry.year = Number(bracketed[2]);
		} else if (bracketed && medium === "book") {
			entry.title = bracketed[1];
			entry.author = bracketed[2].trim();
		}
		lines.set(line, entry);
	}
	return [...lines.values()];
}

/**
 * Bring the record in line with the "also consumed" files. A new line is
 * looked up once in its Medium's Catalog, match or not; a line no longer in
 * its file leaves the record, so an edited line is looked up as a new one.
 * The files' text is kept in the record, where the snapshot finds it.
 */
async function mergeAlsoConsumed(
	{ db, alsoConsumedDir, findInCatalog }: ConsumedOptions,
	errors: unknown[],
): Promise<void> {
	for (const medium of MEDIA) {
		const file = path.join(alsoConsumedDir, `${medium}.txt`);
		const text = existsSync(file) ? readFileSync(file, "utf8") : "";
		if (existsSync(file)) {
			db.prepare(
				`INSERT INTO files (path, content) VALUES (?, ?)
				 ON CONFLICT (path) DO UPDATE SET content = excluded.content`,
			).run(`also-consumed/${medium}.txt`, text);
		}

		const lines = parseAlsoConsumed(text, medium);
		const known = new Set(
			(
				db
					.prepare("SELECT line FROM also_consumed WHERE medium = ?")
					.all(medium) as { line: string }[]
			).map((row) => row.line),
		);
		const written = new Set(lines.map((entry) => entry.line));
		for (const line of known) {
			if (!written.has(line)) {
				db.prepare(
					"DELETE FROM also_consumed WHERE medium = ? AND line = ?",
				).run(medium, line);
			}
		}
		for (const { line, ...query } of lines) {
			if (known.has(line)) {
				continue;
			}
			try {
				const match = await findInCatalog(medium, query);
				db.prepare(
					`INSERT INTO also_consumed (medium, line, catalog_id, title, author)
					 VALUES (?, ?, ?, ?, ?)`,
				).run(
					medium,
					line,
					match?.id ?? null,
					match?.title ?? null,
					match?.author ?? null,
				);
			} catch (error) {
				// Not a miss: the line is tried again on the next tick
				errors.push(error);
				break;
			}
		}
	}
}

/** Look up in IGDB the games in the record that have not been asked about. */
async function lookUpGames(
	{ db, findInCatalog }: ConsumedOptions,
	now: Date,
	errors: unknown[],
): Promise<void> {
	const games = db
		.prepare(
			`SELECT key, title, steam_app_id FROM consumed
			 WHERE medium = 'game' AND looked_up_at IS NULL LIMIT ?`,
		)
		.all(GAME_LOOKUPS_PER_MERGE) as {
		key: string;
		title: string;
		steam_app_id: string | null;
	}[];
	const update = db.prepare(
		`UPDATE consumed SET catalog_id = ?, looked_up_at = ?
		 WHERE medium = 'game' AND key = ?`,
	);
	for (const game of games) {
		try {
			const match = await findInCatalog("game", {
				title: game.title,
				steamAppId: game.steam_app_id ?? undefined,
			});
			update.run(match?.id ?? null, now.toISOString(), game.key);
		} catch (error) {
			// IGDB is failing or out of requests: the rest wait for the next tick
			errors.push(error);
			break;
		}
	}
}

/**
 * Merge what the owner has Consumed into the record: Vercel's full
 * histories, then the "also consumed" files, then the IGDB ids of the games.
 * Each part is done even when another fails; the merge then rejects with
 * what failed, having kept what it could.
 */
export async function mergeConsumed(
	options: ConsumedOptions,
	now: Date,
): Promise<void> {
	const errors: unknown[] = [];
	try {
		await mergeHistories(options.db, options.redis, now);
	} catch (error) {
		errors.push(error);
	}
	await mergeAlsoConsumed(options, errors);
	await lookUpGames(options, now, errors);
	if (errors.length > 0) {
		throw new Error(errors.map(String).join("; "));
	}
}

/** The consumed-set merge, on every tick. */
export function consumedJob(options: ConsumedOptions): Job {
	return {
		name: "consumed",
		isDue: () => true,
		run: (now) => mergeConsumed(options, now),
	};
}
