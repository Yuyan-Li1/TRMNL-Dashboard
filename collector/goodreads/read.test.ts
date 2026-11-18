import { describe, expect, it } from "vitest";
import { openDatabase } from "../db";
import {
	type MarkupBook,
	type MarkupUpdate,
	progressPage,
	tooltipJson,
	widgetScript,
} from "./markup";
import { homeBooks, readGoodreads } from "./read";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-11-18T01:00:00Z"); // the 18th in Sydney

function day(n: number): Date {
	return new Date(T0.getTime() + n * DAY);
}

function book(n: number, extra: Partial<MarkupBook> = {}): MarkupBook {
	return {
		reviewId: `r${n}`.replace("r", "90"),
		bookId: `${n}`,
		title: `Book ${n}`,
		author: `Author ${n}`,
		...extra,
	};
}

/** Goodreads as the owner's shelves stand, and a Collector reading it. */
function goodreads() {
	const world = {
		db: openDatabase(":memory:"),
		read: [] as MarkupBook[],
		reading: [] as MarkupBook[],
		updates: [] as MarkupUpdate[],
		/** Paths that answer with an error */
		down: [] as string[],
		/** What the read shelf's widget answers instead, when set */
		readAnswer: undefined as string | undefined,
		requests: [] as string[],
		async poll(now: Date): Promise<void> {
			await readGoodreads(
				{
					db: world.db,
					userId: "4242",
					pause: async () => {},
					fetchText: async (address) => {
						const url = new URL(address);
						world.requests.push(`${url.pathname}${url.search}`);
						if (world.down.some((path) => url.pathname.startsWith(path))) {
							throw new Error(`Goodreads answered 503 for ${url.pathname}`);
						}
						if (url.pathname === "/review/custom_widget/4242") {
							const shelf = url.searchParams.get("shelf") as string;
							if (shelf === "read") {
								return world.readAnswer ?? widgetScript(shelf, world.read);
							}
							return widgetScript(shelf, world.reading);
						}
						if (url.pathname === "/user_status/list/4242") {
							return progressPage(world.updates);
						}
						if (url.pathname === "/tooltips") {
							const bookId = url.searchParams.get(
								[...url.searchParams.keys()].find((key) =>
									key.endsWith("[id]"),
								) as string,
							) as string;
							return tooltipJson(bookId, {
								averageRating: "4.09",
								description: `About book ${bookId}.`,
							});
						}
						throw new Error(`Unexpected request ${address}`);
					},
				},
				now,
			);
		},
		books() {
			return homeBooks(world.db)?.books ?? [];
		},
		titled(title: string) {
			return world.books().find((entry) => entry.title === title);
		},
	};
	return world;
}

describe("readGoodreads", () => {
	it("publishes nothing until Goodreads has been read", () => {
		expect(homeBooks(goodreads().db)).toBeNull();
	});

	it("records every book already read on the first run with no finish date", async () => {
		const world = goodreads();
		world.read = [book(1, { stars: 4 }), book(2)];
		await world.poll(T0);
		expect(homeBooks(world.db)?.readAt).toBe(T0.toISOString());
		expect(world.books()).toEqual([
			{
				id: "901",
				bookId: "1",
				title: "Book 1",
				author: "Author 1",
				coverUrl:
					"https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1408816275l/1._SY600_.jpg",
				stars: 4,
				shelf: "read",
				// The newest read book is looked up, for when nothing is eligible
				description: "About book 1.",
				publicRating: 4.09,
			},
			{
				id: "902",
				bookId: "2",
				title: "Book 2",
				author: "Author 2",
				coverUrl:
					"https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1408816275l/2._SY600_.jpg",
				shelf: "read",
			},
		]);
	});

	it("dates a book's finish to the owner's day it is first seen as read", async () => {
		const world = goodreads();
		world.read = [book(1)];
		await world.poll(T0);
		world.read = [book(3), book(1)];
		// 20:00 UTC on the 20th is already the 21st in Sydney
		await world.poll(new Date("2026-11-20T20:00:00Z"));
		expect(world.titled("Book 3")?.finishedOn).toBe("2026-11-21");
		expect(world.titled("Book 1")?.finishedOn).toBeUndefined();
		// Finished books come before those with no date, and keep their day
		await world.poll(day(5));
		expect(world.books().map((entry) => entry.title)).toEqual([
			"Book 3",
			"Book 1",
		]);
		expect(world.titled("Book 3")?.finishedOn).toBe("2026-11-21");
	});

	it("finishes a book that moves from currently-reading to read", async () => {
		const world = goodreads();
		world.read = [book(1)];
		world.reading = [book(2)];
		await world.poll(T0);
		expect(world.titled("Book 2")).toMatchObject({ shelf: "reading" });

		world.read = [book(2, { stars: 5 }), book(1)];
		world.reading = [];
		await world.poll(day(1));
		expect(world.titled("Book 2")).toMatchObject({
			shelf: "read",
			stars: 5,
			finishedOn: "2026-11-19",
		});
	});

	it("shows a rating added later without finishing the book again", async () => {
		const world = goodreads();
		world.read = [book(1)];
		await world.poll(T0);
		world.read = [book(2), book(1)];
		await world.poll(day(1));
		world.read = [book(2, { stars: 3 }), book(1)];
		await world.poll(day(4));
		expect(world.titled("Book 2")).toMatchObject({
			stars: 3,
			finishedOn: "2026-11-19",
		});
	});

	it("does not finish a book pushed into a full list from below", async () => {
		const world = goodreads();
		const hundred = Array.from({ length: 100 }, (_, n) => book(n + 1));
		world.read = hundred;
		await world.poll(T0);
		// Book 50 leaves the shelf; book 101, read long ago, takes the last place
		world.read = [
			...hundred.filter((entry) => entry.bookId !== "50"),
			book(101),
		];
		await world.poll(day(1));
		expect(world.books().every((entry) => !entry.finishedOn)).toBe(true);
	});

	it("gives a book in progress its latest progress update", async () => {
		const world = goodreads();
		world.read = [book(1)];
		world.reading = [book(2), book(3)];
		world.updates = [
			{ bookId: "3", says: "is 40% done with", when: "Nov 16, 2026 09:00PM" },
			{
				bookId: "2",
				says: "is on page 137 of 248 of",
				when: "Nov 10, 2026 07:27AM",
			},
			{
				bookId: "2",
				says: "is on page 20 of 248 of",
				when: "Nov 02, 2026 07:27AM",
			},
		];
		await world.poll(T0);
		// Latest progress first
		expect(world.books().slice(0, 2)).toMatchObject([
			{
				title: "Book 3",
				shelf: "reading",
				progress: { percent: 40, at: "2026-11-16T21:00:00.000Z" },
				description: "About book 3.",
			},
			{
				title: "Book 2",
				shelf: "reading",
				progress: { page: 137, pages: 248, at: "2026-11-10T07:27:00.000Z" },
			},
		]);
	});

	it("drops a book taken off the currently-reading shelf unfinished", async () => {
		const world = goodreads();
		world.read = [book(1)];
		world.reading = [book(2)];
		await world.poll(T0);
		world.reading = [];
		await world.poll(day(1));
		expect(world.books().map((entry) => entry.title)).toEqual(["Book 1"]);
	});

	it("looks a book up once, and tries again after a lookup that failed", async () => {
		const world = goodreads();
		world.read = [book(1)];
		world.reading = [book(2)];
		world.down = ["/tooltips"];
		await world.poll(T0);
		// The read itself is good
		expect(world.titled("Book 2")).toMatchObject({ shelf: "reading" });
		expect(world.titled("Book 2")?.description).toBeUndefined();

		world.down = [];
		await world.poll(day(1));
		expect(world.titled("Book 2")?.description).toBe("About book 2.");
		const before = world.requests.length;
		await world.poll(day(2));
		const lookups = world.requests
			.slice(before)
			.filter((request) => request.startsWith("/tooltips"));
		expect(lookups).toEqual([]);
	});

	it("sends each widget query its own widget_id, new on every read", async () => {
		const world = goodreads();
		await world.poll(T0);
		await world.poll(day(1));
		const ids = world.requests
			.filter((request) => request.startsWith("/review/custom_widget"))
			.map((request) => new URLSearchParams(request).get("widget_id"));
		expect(new Set(ids).size).toBe(4);
		expect(world.requests[0]).toBe(
			`/review/custom_widget/4242?shelf=read&sort=date_read&order=d&num_books=100&widget_id=${ids[0]}`,
		);
	});

	it.each([
		["the read shelf", "/review/custom_widget"],
		["the progress list", "/user_status"],
	])("fails and keeps the last good data when %s errors", async (_, path) => {
		const world = goodreads();
		world.read = [book(1)];
		await world.poll(T0);
		world.read = [book(2), book(1)];
		world.down = [path];
		await expect(world.poll(day(1))).rejects.toThrow("Goodreads answered 503");
		expect(world.books().map((entry) => entry.title)).toEqual(["Book 1"]);
		expect(homeBooks(world.db)?.readAt).toBe(T0.toISOString());

		// Nothing was recorded as finished on the failed day
		world.down = [];
		await world.poll(day(2));
		expect(world.titled("Book 2")?.finishedOn).toBe("2026-11-20");
	});

	it("fails when the read shelf had books and now parses to none", async () => {
		const world = goodreads();
		world.read = [book(1)];
		world.reading = [book(2)];
		await world.poll(T0);
		world.read = [];
		await expect(world.poll(day(1))).rejects.toThrow(
			"read shelf had books and now has none",
		);
		expect(world.books()).toHaveLength(2);
	});

	it("fails when the widget answers for another shelf", async () => {
		const world = goodreads();
		world.read = [book(1)];
		await world.poll(T0);
		world.readAnswer = widgetScript("currently-reading", [book(9)]);
		await expect(world.poll(day(1))).rejects.toThrow('not "read"');
		expect(world.books().map((entry) => entry.title)).toEqual(["Book 1"]);
	});
});
