import { describe, expect, it } from "vitest";
import { parseDiaryFeed } from "./letterboxd";

function feed(...items: string[]): string {
	return `<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">
	<channel>
		<title>Letterboxd - Owner</title>
		<link>https://letterboxd.com/owner/</link>
		${items.join("\n")}
	</channel>
</rss>`;
}

const WATCH = `<item> <title>Past Lives, 2023 - ★★★★½</title> <link>https://letterboxd.com/owner/film/past-lives/</link> <guid isPermaLink="false">letterboxd-watch-1001</guid> <pubDate>Mon, 16 Nov 2026 08:07:09 +1300</pubDate> <letterboxd:watchedDate>2026-11-15</letterboxd:watchedDate> <letterboxd:rewatch>No</letterboxd:rewatch> <letterboxd:filmTitle>Past Lives</letterboxd:filmTitle> <letterboxd:filmYear>2023</letterboxd:filmYear> <letterboxd:memberRating>4.5</letterboxd:memberRating> <letterboxd:memberLike>Yes</letterboxd:memberLike> <tmdb:movieId>666277</tmdb:movieId> <description><![CDATA[ <p><img src="https://a.ltrbxd.com/resized/film-poster/past-lives-0-600-0-900-crop.jpg?v=abc"/></p> <p>Watched on Sunday November 15, 2026.</p> ]]></description> <dc:creator>Owner</dc:creator> </item>`;

const REVIEW = `<item> <title>The President&#039;s Cake, 2025</title> <link>https://letterboxd.com/owner/film/the-presidents-cake/1/</link> <guid isPermaLink="false">letterboxd-review-1002</guid> <pubDate>Tue, 17 Nov 2026 09:00:00 +1300</pubDate> <letterboxd:watchedDate>2026-11-16</letterboxd:watchedDate> <letterboxd:rewatch>Yes</letterboxd:rewatch> <letterboxd:filmTitle>The President&#039;s Cake</letterboxd:filmTitle> <letterboxd:filmYear>2025</letterboxd:filmYear> <tmdb:movieId>1354700</tmdb:movieId> <description><![CDATA[ <p><img src="https://a.ltrbxd.com/resized/film-poster/cake-0-600-0-900-crop.jpg?v=def"/></p> <p>Small, funny &amp; sad.<br />It&#039;s <i>better</i> the second time.</p><p>Bring tissues.</p> ]]></description> <dc:creator>Owner</dc:creator> </item>`;

const LIST = `<item> <title>Ranked: Joel &amp; Ethan Coen</title> <link>https://letterboxd.com/owner/list/coens/</link> <guid isPermaLink="false">letterboxd-list-2001</guid> <pubDate>Thu, 19 Mar 2026 21:30:34 +1300</pubDate> <description><![CDATA[ <p>A list.</p> ]]></description> <dc:creator>Owner</dc:creator> </item>`;

describe("parseDiaryFeed", () => {
	it("reads a diary entry's title, year, watched date, rating, TMDB id and poster", () => {
		expect(parseDiaryFeed(feed(WATCH))).toEqual([
			{
				id: "letterboxd-watch-1001",
				title: "Past Lives",
				year: 2023,
				watchedOn: "2026-11-15",
				rewatch: false,
				stars: 4.5,
				tmdbId: "666277",
				imageUrl:
					"https://a.ltrbxd.com/resized/film-poster/past-lives-0-600-0-900-crop.jpg?v=abc",
			},
		]);
	});

	it("reads the review as plain text, and the rewatch flag, from a reviewed entry without a rating", () => {
		const [entry] = parseDiaryFeed(feed(REVIEW));

		expect(entry.title).toBe("The President's Cake");
		expect(entry.rewatch).toBe(true);
		expect(entry.stars).toBeUndefined();
		expect(entry.review).toBe(
			"Small, funny & sad. It's better the second time. Bring tissues.",
		);
	});

	it("leaves out the spoiler notice Letterboxd puts before a review", () => {
		const spoiler = REVIEW.replace(
			"<p>Small,",
			"<p><em>This review may contain spoilers.</em></p> <p>Small,",
		);

		expect(parseDiaryFeed(feed(spoiler))[0].review).toBe(
			"Small, funny & sad. It's better the second time. Bring tissues.",
		);
	});

	it("keeps diary entries only, most recently watched first", () => {
		const entries = parseDiaryFeed(feed(LIST, WATCH, REVIEW));

		expect(entries.map((entry) => entry.id)).toEqual([
			"letterboxd-review-1002",
			"letterboxd-watch-1001",
		]);
	});

	it("keeps a diary entry that is not a movie on TMDB, without a TMDB id", () => {
		const show = WATCH.replace(
			"<tmdb:movieId>666277</tmdb:movieId>",
			"<tmdb:tvId>1396</tmdb:tvId>",
		);

		expect(parseDiaryFeed(feed(show))[0].tmdbId).toBeUndefined();
	});

	it("rejects a page that is not a feed", () => {
		expect(() => parseDiaryFeed("<html>Just a moment...</html>")).toThrow(
			"not a feed",
		);
	});
});
