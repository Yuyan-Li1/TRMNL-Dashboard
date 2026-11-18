import { describe, expect, it } from "vitest";
import type { Book } from "@/types/books";
import { booksContent } from "./books";

// 09:00 on 18 November 2026 in Sydney
const NOW = new Date("2026-11-17T22:00:00Z");
const COVER = "https://i.gr-assets.com/books/1l/1._SY600_.jpg";

function reading(overrides: Partial<Book> = {}): Book {
	return {
		id: "9001",
		bookId: "1",
		title: "The Long Ships",
		author: "Frans G. Bengtsson",
		coverUrl: COVER,
		shelf: "reading",
		progress: { page: 137, pages: 248, at: "2026-11-15T07:27:00.000Z" },
		description: "A saga of the Viking age.",
		publicRating: 4.3,
		posterUrl: COVER,
		thumbnailUrl: COVER,
		...overrides,
	};
}

function finished(overrides: Partial<Book> = {}): Book {
	return {
		id: "9002",
		bookId: "2",
		title: "We Die Alone",
		author: "David Howarth",
		coverUrl: COVER,
		stars: 4,
		shelf: "read",
		finishedOn: "2026-11-17",
		description: "An escape across arctic Norway.",
		posterUrl: COVER,
		...overrides,
	};
}

describe("booksContent", () => {
	it("shows a book being read as In progress with the author, the page, when, a progress bar and the description, and no rating", () => {
		const content = booksContent([reading({ stars: 5 })], NOW);
		expect(content.eligible).toEqual([
			{
				id: "book:9001",
				medium: "book",
				mode: "In progress",
				title: "The Long Ships",
				byline: "Frans G. Bengtsson",
				facts: ["Page 137 of 248", "Updated 3 days ago"],
				progress: 137 / 248,
				text: "A saga of the Viking age.",
				activityAt: "2026-11-15T00:00:00.000Z",
				posterUrl: COVER,
			},
		]);
	});

	it("shows a percentage when the update gave no page", () => {
		const [candidate] = booksContent(
			[reading({ progress: { percent: 40, at: "2026-11-18T01:00:00.000Z" } })],
			NOW,
		).eligible;
		expect(candidate).toMatchObject({
			facts: ["40%", "Updated today"],
			progress: 0.4,
		});
	});

	it("shows a book first seen as read as Finished with the owner's stars and when", () => {
		const content = booksContent([finished()], NOW);
		expect(content.eligible).toEqual([
			{
				id: "book:9002",
				medium: "book",
				mode: "Finished",
				title: "We Die Alone",
				byline: "David Howarth",
				rating: { stars: 4, whose: "You" },
				facts: ["Finished yesterday"],
				text: "An escape across arctic Norway.",
				activityAt: "2026-11-17T00:00:00.000Z",
				posterUrl: COVER,
			},
		]);
		expect(
			booksContent([finished({ stars: undefined })], NOW).eligible[0]?.rating,
		).toBeUndefined();
	});

	it("keeps a book eligible for 14 days from its activity", () => {
		const eligible = (book: Book): number =>
			booksContent([book], NOW).eligible.length;
		expect(eligible(finished({ finishedOn: "2026-11-04" }))).toBe(1);
		expect(eligible(finished({ finishedOn: "2026-11-03" }))).toBe(0);
		expect(
			eligible(
				reading({ progress: { percent: 10, at: "2026-11-04T23:00:00.000Z" } }),
			),
		).toBe(1);
		expect(
			eligible(
				reading({ progress: { percent: 10, at: "2026-11-03T23:00:00.000Z" } }),
			),
		).toBe(0);
	});

	it("never makes eligible a book with no progress update or no finish date", () => {
		const content = booksContent(
			[reading({ progress: undefined }), finished({ finishedOn: undefined })],
			NOW,
		);
		expect(content.eligible).toEqual([]);
		// Both can still be the Spotlight when nothing at all is eligible
		expect(content.fallback).toMatchObject([
			{
				mode: "In progress",
				facts: [],
				activityAt: "1970-01-01T00:00:00.000Z",
			},
			{ mode: "Finished", facts: [] },
		]);
	});

	it("leaves a book without artwork out of the Spotlight", () => {
		const content = booksContent([reading({ posterUrl: undefined })], NOW);
		expect(content.eligible).toEqual([]);
		expect(content.fallback).toEqual([]);
		expect(content.latest?.title).toBe("The Long Ships");
	});

	it("shows on the card a book in progress with its last known progress, however old", () => {
		const content = booksContent(
			[
				reading({
					progress: { page: 20, pages: 248, at: "2026-08-01T07:00:00.000Z" },
				}),
				finished({ finishedOn: undefined }),
			],
			NOW,
		);
		expect(content.eligible).toEqual([]);
		expect(content.latest).toEqual({
			title: "The Long Ships",
			stars: undefined,
			detail: "Page 20 of 248",
			when: "3 months ago",
			thumbnailUrl: COVER,
		});
	});

	it("shows on the card the latest activity: a book finished after the last progress update", () => {
		const content = booksContent(
			[reading(), finished({ thumbnailUrl: COVER })],
			NOW,
		);
		expect(content.latest).toEqual({
			title: "We Die Alone",
			stars: 4,
			detail: "Finished",
			when: "yesterday",
			thumbnailUrl: COVER,
		});
	});

	it("shows the first book as published when none has a dated activity", () => {
		const content = booksContent(
			[
				finished({ finishedOn: undefined }),
				finished({ id: "9003", title: "Older", finishedOn: undefined }),
			],
			NOW,
		);
		expect(content.latest).toMatchObject({
			title: "We Die Alone",
			detail: "Finished",
			when: undefined,
		});
	});

	it("has nothing to show with no books", () => {
		expect(booksContent([], NOW)).toEqual({
			medium: "book",
			eligible: [],
			fallback: [],
			latest: null,
		});
	});
});
