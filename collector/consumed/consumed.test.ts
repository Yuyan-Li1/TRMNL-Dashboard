import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type ConsumedSet, consumedKey } from "@/lib/consumed/set";
import type { Medium } from "@/lib/screen/types";
import {
	type HistoryGame,
	type HistorySource,
	type HistoryTitle,
	historyKey,
} from "@/types/history";
import { openDatabase } from "../db";
import type { HomeRedis } from "../redis";
import { type CatalogQuery, mergeConsumed } from "./merge";
import { seedConsumed } from "./seed";
import { publishConsumed, unmatchedLines } from "./sets";

const NOW = new Date("2026-11-18T01:00:00Z");

const WATCHED_CSV = `Date,Name,Year,Letterboxd URI
2022-11-02,All Quiet on the Western Front,2022,https://boxd.it/H08
2022-11-02,"Monsters, Inc.",2001,https://boxd.it/2a2k
`;
const TMDB_MAP = [
	{
		name: "All Quiet on the Western Front",
		year: "2022",
		uri: "https://boxd.it/H08",
		tmdbId: 49046,
		tmdbType: "movie",
	},
	{
		name: "Monsters, Inc.",
		year: "2001",
		uri: "https://boxd.it/2a2k",
		tmdbId: 585,
		tmdbType: "movie",
	},
];
const GOODREADS_CSV = `Book Id,Title,Author,ISBN,My Rating,Exclusive Shelf
1001,"Dune (Dune, #1)",Frank Herbert,"=""0441172717""",5,read
1002,"The Dispossessed",Ursula K. Le Guin,,4,read
1003,Abandoned Halfway,Some Author,,0,did-not-finish
1004,Unread Classic,Another Author,,0,to-read
`;

/** A home server with its exports copied over and nothing merged yet. */
function home() {
	const dir = mkdtempSync(path.join(tmpdir(), "collector-"));
	const exportsDir = path.join(dir, "exports");
	const alsoConsumedDir = path.join(dir, "also-consumed");
	mkdirSync(path.join(exportsDir, "letterboxd"), { recursive: true });
	mkdirSync(alsoConsumedDir);
	writeFileSync(
		path.join(exportsDir, "letterboxd", "watched.csv"),
		WATCHED_CSV,
	);
	writeFileSync(
		path.join(exportsDir, "letterboxd-tmdb-map.json"),
		JSON.stringify(TMDB_MAP),
	);
	writeFileSync(
		path.join(exportsDir, "goodreads_library_export.csv"),
		GOODREADS_CSV,
	);

	const keys = new Map<string, unknown>();
	const redis: HomeRedis = {
		get: async <T>(key: string) => (keys.get(key) as T | undefined) ?? null,
		set: async (key, value) => {
			keys.set(key, value);
		},
		del: async (key) => {
			keys.delete(key);
		},
	};
	const db = openDatabase(":memory:");
	const world = {
		db,
		exportsDir,
		/** What each Catalog knows, by medium and title */
		catalog: new Map<string, { id: string; title: string; author?: string }>(),
		lookups: [] as string[],
		catalogWorks: true,
		history(source: HistorySource, titles: (HistoryGame | HistoryTitle)[]) {
			keys.set(historyKey(source), { titles, readAt: NOW.toISOString() });
		},
		alsoConsumed(medium: Medium, text: string) {
			writeFileSync(path.join(alsoConsumedDir, `${medium}.txt`), text);
		},
		seed() {
			return seedConsumed(db, exportsDir, NOW);
		},
		merge() {
			return mergeConsumed(
				{
					db,
					redis,
					alsoConsumedDir,
					findInCatalog: async (medium: Medium, query: CatalogQuery) => {
						world.lookups.push(
							[medium, query.title, query.year ?? query.author]
								.filter(Boolean)
								.join(":"),
						);
						if (!world.catalogWorks) {
							throw new Error("Catalog request failed: 500");
						}
						return world.catalog.get(`${medium}:${query.title}`) ?? null;
					},
				},
				NOW,
			);
		},
		/** Merge, publish, and read back what Vercel would see */
		async published(medium: Medium): Promise<ConsumedSet | undefined> {
			await world.merge();
			await publishConsumed(db, redis, NOW);
			return keys.get(consumedKey(medium)) as ConsumedSet | undefined;
		},
	};
	return world;
}

describe("collector seed", () => {
	it("loads every film in the Letterboxd export by its TMDB id", async () => {
		const world = home();
		expect(world.seed()).toEqual({ films: 2, books: 2 });
		expect((await world.published("movie"))?.ids.toSorted()).toEqual([
			"49046",
			"585",
		]);
	});

	it("loads the read books of the Goodreads export, not a did-not-finish or to-read book", async () => {
		const world = home();
		world.seed();
		const books = await world.published("book");
		expect(books?.ids.toSorted()).toEqual(["1001", "1002"]);
		// Another edition has another id: it is matched by title and author
		expect(books?.names.toSorted()).toEqual([
			"dune|frankherbert",
			"thedispossessed|ursulakleguin",
		]);
	});

	it("is safe to run twice", async () => {
		const world = home();
		world.seed();
		expect(world.seed()).toEqual({ films: 2, books: 2 });
		expect((await world.published("movie"))?.ids).toHaveLength(2);
	});

	it("fails, loading nothing, when a film is missing from the TMDB map", async () => {
		const world = home();
		writeFileSync(
			path.join(world.exportsDir, "letterboxd-tmdb-map.json"),
			JSON.stringify(TMDB_MAP.slice(0, 1)),
		);
		expect(() => world.seed()).toThrow(/Monsters, Inc\. \(2001\)/);
		expect(await world.published("movie")).toBeUndefined();
	});
});

describe("the consumed set", () => {
	it("is not published until the exports are seeded", async () => {
		const world = home();
		world.history("trakt", [{ tmdbId: "97546", title: "Ted Lasso" }]);
		expect(await world.published("show")).toBeUndefined();
		world.seed();
		expect((await world.published("show"))?.ids).toEqual(["97546"]);
	});

	it("counts a game with 30 minutes of play, any trophy, or no play time recorded", async () => {
		const world = home();
		world.seed();
		world.history("psn", [
			{ name: "Played Enough", minutesPlayed: 30 },
			{ name: "Barely Tried", minutesPlayed: 29 },
			{ name: "Tried With A Trophy", minutesPlayed: 5, achievements: 1 },
			{ name: "Trophy List Only", achievements: 0 },
		]);
		world.history("xbox", [{ name: "Seen By The Xbox App" }]);
		expect((await world.published("game"))?.names.toSorted()).toEqual([
			"playedenough",
			"seenbythexboxapp",
			"triedwithatrophy",
			"trophylistonly",
		]);
	});

	it("counts every game in the Steam library, played or not", async () => {
		const world = home();
		world.seed();
		world.history("steam", [
			{ name: "Backlog", minutesPlayed: 0, owned: true, steamAppId: "10" },
		]);
		expect((await world.published("game"))?.names).toEqual(["backlog"]);
	});

	it("looks each game up in IGDB once and publishes its id", async () => {
		const world = home();
		world.seed();
		world.catalog.set("game:Hades II", { id: "113112", title: "Hades II" });
		world.history("steam", [
			{
				name: "Hades II",
				minutesPlayed: 600,
				owned: true,
				steamAppId: "1145350",
			},
		]);
		world.history("switch", [{ name: "Not In IGDB", minutesPlayed: 90 }]);
		expect((await world.published("game"))?.ids).toEqual(["113112"]);
		expect(world.lookups.toSorted()).toEqual([
			"game:Hades II",
			"game:Not In IGDB",
		]);

		await world.merge();
		expect(world.lookups).toHaveLength(2);
	});

	it("looks a game up again on the next tick when IGDB could not be asked", async () => {
		const world = home();
		world.seed();
		world.catalog.set("game:Hades II", { id: "113112", title: "Hades II" });
		world.history("switch", [{ name: "Hades II", minutesPlayed: 600 }]);
		world.catalogWorks = false;
		await expect(world.merge()).rejects.toThrow(/Catalog request failed/);
		world.catalogWorks = true;
		expect((await world.published("game"))?.ids).toEqual(["113112"]);
	});

	it("keeps a movie that has since left the feed, with the export's films", async () => {
		const world = home();
		world.seed();
		world.history("letterboxd", [{ tmdbId: "1", title: "Logged Last Week" }]);
		await world.merge();
		world.history("letterboxd", [{ tmdbId: "2", title: "Logged Today" }]);
		expect((await world.published("movie"))?.ids.toSorted()).toEqual([
			"1",
			"2",
			"49046",
			"585",
		]);
	});

	it("counts a book on the read shelf, not one being read", async () => {
		const world = home();
		world.seed();
		const insert = world.db.prepare(
			`INSERT INTO books (review_id, book_id, title, author, shelf)
			 VALUES (?, ?, ?, ?, ?)`,
		);
		insert.run("r1", "2001", "Piranesi", "Susanna Clarke", "read");
		insert.run("r2", "2002", "Still Reading", "An Author", "reading");
		const books = await world.published("book");
		expect(books?.ids).toContain("2001");
		expect(books?.ids).not.toContain("2002");
		expect(books?.names).toContain("piranesi|susannaclarke");
	});
});

describe("the also-consumed files", () => {
	it("looks each line up once, with its year or author, and adds the match to the set", async () => {
		const world = home();
		world.seed();
		world.catalog.set("show:Severance", { id: "95396", title: "Severance" });
		world.catalog.set("book:Piranesi", {
			id: "50202953",
			title: "Piranesi",
			author: "Susanna Clarke",
		});
		world.alsoConsumed("show", "# Watched at a friend's\nSeverance (2022)\n\n");
		world.alsoConsumed("book", "Piranesi (Susanna Clarke)\n");
		expect((await world.published("show"))?.ids).toEqual(["95396"]);
		const books = await world.published("book");
		expect(books?.ids).toContain("50202953");
		expect(books?.names).toContain("piranesi|susannaclarke");
		expect(world.lookups).toEqual([
			"show:Severance:2022",
			"book:Piranesi:Susanna Clarke",
		]);
	});

	it("reports a line with no match, and tries it again only when it is edited", async () => {
		const world = home();
		world.seed();
		world.alsoConsumed("game", "Hadez II\n");
		await world.merge();
		await world.merge();
		expect(world.lookups).toEqual(["game:Hadez II"]);
		expect(unmatchedLines(world.db)).toEqual([
			{ medium: "game", line: "Hadez II" },
		]);

		world.catalog.set("game:Hades II", { id: "113112", title: "Hades II" });
		world.alsoConsumed("game", "Hades II\n");
		expect((await world.published("game"))?.ids).toEqual(["113112"]);
		expect(unmatchedLines(world.db)).toEqual([]);
	});

	it("drops a title from the set when its line is removed", async () => {
		const world = home();
		world.seed();
		world.catalog.set("movie:Heat", { id: "949", title: "Heat" });
		world.alsoConsumed("movie", "Heat (1995)\n");
		expect((await world.published("movie"))?.ids).toContain("949");
		world.alsoConsumed("movie", "");
		expect((await world.published("movie"))?.ids).not.toContain("949");
	});

	it("leaves a line for the next tick when the Catalog could not be asked", async () => {
		const world = home();
		world.seed();
		world.catalog.set("movie:Heat", { id: "949", title: "Heat" });
		world.alsoConsumed("movie", "Heat\n");
		world.catalogWorks = false;
		await expect(world.merge()).rejects.toThrow(/Catalog request failed/);
		expect(unmatchedLines(world.db)).toEqual([]);
		world.catalogWorks = true;
		expect((await world.published("movie"))?.ids).toContain("949");
	});
});
