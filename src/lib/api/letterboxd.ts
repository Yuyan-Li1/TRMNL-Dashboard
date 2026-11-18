import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { trackRead } from "@/lib/health/reads";
import type { DiaryEntry } from "@/types/movies";

/**
 * Letterboxd, the Source for movies, read from the owner's public diary
 * feed. The feed holds the latest 100 items, mixing diary entries and lists.
 * Letterboxd's official API is not used.
 */
const FETCH_TIMEOUT_MS = 10_000;
const SPOILER_NOTICE =
	/<p>\s*<em>\s*This review may contain spoilers\.\s*<\/em>\s*<\/p>/i;

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function decodeEntities(text: string): string {
	return text.replace(
		/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
		(whole, entity: string) => {
			if (entity[0] !== "#") {
				return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
			}
			const code =
				entity[1].toLowerCase() === "x"
					? Number.parseInt(entity.slice(2), 16)
					: Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(code) && code <= 0x10ffff
				? String.fromCodePoint(code)
				: whole;
		},
	);
}

/** The text inside the first `<name>` element of an item, if it has one. */
function element(item: string, name: string): string | undefined {
	const match = item.match(
		new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`),
	);
	if (!match) {
		return undefined;
	}
	const cdata = match[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
	return (cdata ? cdata[1] : match[1]).trim();
}

/** The review's HTML as one run of plain text. */
function reviewText(description: string): string | undefined {
	const text = decodeEntities(
		description
			.replace(/<p>\s*<img[^>]*>\s*<\/p>/i, "")
			.replace(SPOILER_NOTICE, "")
			.replace(/<br\s*\/?>|<\/p>/gi, " ")
			.replace(/<[^>]+>/g, ""),
	)
		.replace(/\s+/g, " ")
		.trim();
	return text || undefined;
}

function toDiaryEntry(item: string): DiaryEntry | null {
	const id = element(item, "guid");
	const watchedOn = element(item, "letterboxd:watchedDate");
	const title = element(item, "letterboxd:filmTitle");
	// A list has no watched date: only diary entries carry one
	if (!id || !title || !watchedOn || !/^\d{4}-\d{2}-\d{2}$/.test(watchedOn)) {
		return null;
	}

	const description = element(item, "description") ?? "";
	const year = Number(element(item, "letterboxd:filmYear"));
	const rating = element(item, "letterboxd:memberRating");
	const stars = rating === undefined ? Number.NaN : Number(rating);

	const entry: DiaryEntry = {
		id,
		title: decodeEntities(title),
		watchedOn,
		rewatch: element(item, "letterboxd:rewatch") === "Yes",
	};
	if (Number.isInteger(year) && year > 0) {
		entry.year = year;
	}
	if (Number.isFinite(stars) && stars > 0) {
		entry.stars = stars;
	}
	if (id.startsWith("letterboxd-review-")) {
		const review = reviewText(description);
		if (review) {
			entry.review = review;
		}
	}
	const tmdbId = element(item, "tmdb:movieId");
	if (tmdbId) {
		entry.tmdbId = tmdbId;
	}
	const image = description.match(/<img[^>]*\ssrc="([^"]+)"/i);
	if (image) {
		entry.imageUrl = decodeEntities(image[1]);
	}
	return entry;
}

/**
 * The diary entries in a Letterboxd feed, most recently watched first.
 * Lists are left out. Entries watched on the same day keep the feed's
 * order, which is most recently logged first.
 */
export function parseDiaryFeed(xml: string): DiaryEntry[] {
	if (!/<rss[\s>]/.test(xml)) {
		throw new Error("Letterboxd answered with a page that is not a feed");
	}
	const entries: DiaryEntry[] = [];
	for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
		const entry = toDiaryEntry(item);
		if (entry) {
			entries.push(entry);
		}
	}
	return entries.toSorted((a, b) => b.watchedOn.localeCompare(a.watchedOn));
}

/**
 * The owner's latest diary entries, most recently watched first. Cached for
 * an hour.
 */
export async function getDiaryEntries(): Promise<DiaryEntry[]> {
	const cached = await cacheGet<DiaryEntry[]>(CACHE_KEYS.MOVIES_LETTERBOXD);
	if (cached) {
		return cached;
	}

	return trackRead("letterboxd", async () => {
		const username = process.env.LETTERBOXD_USERNAME;
		if (!username) {
			throw new Error("LETTERBOXD_USERNAME not configured");
		}

		const response = await fetch(
			`https://letterboxd.com/${encodeURIComponent(username)}/rss/`,
			{
				headers: { Accept: "application/rss+xml, application/xml" },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			},
		);
		if (!response.ok) {
			throw new Error(`Letterboxd feed request failed: ${response.status}`);
		}
		const entries = parseDiaryFeed(await response.text());

		await cacheSet(CACHE_KEYS.MOVIES_LETTERBOXD, entries, CACHE_TTL.MOVIES);
		return entries;
	});
}
