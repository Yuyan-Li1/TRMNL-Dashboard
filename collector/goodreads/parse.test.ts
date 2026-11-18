import { describe, expect, it } from "vitest";
import { progressPage, tooltipJson, widgetScript } from "./markup";
import { parseProgressList, parseTooltip, parseWidget } from "./parse";

const NOW = new Date("2026-11-18T01:00:00Z");

describe("parseWidget", () => {
	it("gives each book's review id, title, first author, cover and rating, in order", () => {
		const script = widgetScript("read", [
			{
				reviewId: "8823456367",
				bookId: "22921276",
				title: "London Falling: A Family&#39;s Search",
				author: "David Howarth",
				stars: 4,
			},
			{
				reviewId: "3634418775",
				bookId: "10081041",
				title: "The Long Ships",
				author: "Frans G. Bengtsson",
			},
		]);
		expect(parseWidget(script, "read")).toEqual([
			{
				reviewId: "8823456367",
				bookId: "22921276",
				title: "London Falling: A Family's Search",
				author: "David Howarth",
				// The size suffix is rewritten to about 397x600
				coverUrl:
					"https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1408816275l/22921276._SY600_.jpg",
				stars: 4,
			},
			{
				reviewId: "3634418775",
				bookId: "10081041",
				title: "The Long Ships",
				author: "Frans G. Bengtsson",
				coverUrl:
					"https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1408816275l/10081041._SY600_.jpg",
			},
		]);
	});

	it("gives a book with the placeholder cover no cover and no book id", () => {
		const [book] = parseWidget(
			widgetScript("read", [
				{
					reviewId: "1",
					bookId: "2",
					title: "Coverless",
					author: "Anon",
					noCover: true,
				},
			]),
			"read",
		);
		expect(book).toEqual({ reviewId: "1", title: "Coverless", author: "Anon" });
	});

	it("reads an empty shelf as no books", () => {
		expect(
			parseWidget(widgetScript("currently-reading", []), "currently-reading"),
		).toEqual([]);
	});

	it("refuses a widget for another shelf: the cache ignores the shelf asked for", () => {
		expect(() =>
			parseWidget(widgetScript("read", []), "currently-reading"),
		).toThrow('is for the shelf "read", not "currently-reading"');
	});

	it("refuses a page that is not a widget", () => {
		expect(() => parseWidget("<html>Sign in</html>", "read")).toThrow(
			"not a widget",
		);
	});
});

describe("parseProgressList", () => {
	it("reads pages, percentages and a start, newest first, leaving other updates out", () => {
		const page = progressPage([
			{
				bookId: "236377531",
				says: "is on page 137 of 248 of",
				when: "Jun 02, 2026 07:27AM",
			},
			{
				bookId: "56883526",
				says: "is 81% done with",
				when: "Dec 31, 2025 12:05PM",
			},
			{ bookId: "7190", says: "is starting", when: "Dec 01, 2025 12:30AM" },
		]);
		expect(parseProgressList(page, NOW)).toEqual([
			{
				bookId: "236377531",
				page: 137,
				pages: 248,
				at: "2026-06-02T07:27:00.000Z",
			},
			{ bookId: "56883526", percent: 81, at: "2025-12-31T12:05:00.000Z" },
			{ bookId: "7190", percent: 0, at: "2025-12-01T00:30:00.000Z" },
		]);
	});

	it("reads a recent update written as time ago", () => {
		const page = progressPage([
			{
				bookId: "7190",
				says: "is 10% done with",
				when: "21 hours, 40 min ago",
			},
		]);
		expect(parseProgressList(page, NOW)[0]?.at).toBe(
			"2026-11-17T03:20:00.000Z",
		);
	});

	it("refuses a page that is not the progress list", () => {
		expect(() => parseProgressList("<html>Sign in</html>", NOW)).toThrow(
			"not the progress list",
		);
	});
});

describe("parseTooltip", () => {
	it("gives the whole description and the average rating", () => {
		const description =
			"We Die Alone recounts one of the most exciting escape stories &amp; more, in full.";
		expect(
			parseTooltip(
				tooltipJson("22921276", { averageRating: "4.09", description }),
				"22921276",
			),
		).toEqual({
			averageRating: 4.09,
			description:
				"We Die Alone recounts one of the most exciting escape stories & more, in full.",
		});
	});

	it("refuses an answer without the book", () => {
		expect(() => parseTooltip('{"tooltips":{}}', "1")).toThrow(
			"no tooltip for book 1",
		);
		expect(() => parseTooltip("", "1")).toThrow("no tooltip for book 1");
	});
});
