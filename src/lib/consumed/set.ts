import { cleanGameName, matchKey } from "@/lib/games/titles";
import type { Medium } from "@/lib/screen/types";

/**
 * The consumed set as the Collector publishes it, one per Medium, and how a
 * title is checked against it. Shared by both sides: the Collector writes
 * the sets, Vercel reads them before it makes a Catalog pick.
 */

/** The Collector's key for one Medium's consumed set. */
export function consumedKey(medium: Medium): string {
	return `home:consumed:${medium}`;
}

/** The value of a consumed-set key. */
export interface ConsumedSet {
	/**
	 * Catalog ids: IGDB for a game, TMDB for a movie or show, Goodreads for
	 * a book
	 */
	ids: string[];
	/**
	 * Name keys (see `nameKey`), for what an id cannot match: a game IGDB
	 * does not know by the name its source gives it, another edition of a
	 * book. Movies and shows have none.
	 */
	names: string[];
	publishedAt: string;
}

/** A book's title without Goodreads' series suffix: "Dune (Dune, #1)". */
function bareBookTitle(title: string): string {
	return title.replace(/\s*\([^()]*\)\s*$/, "");
}

/**
 * The form of a title's name that two spellings of it agree on: a game's
 * cleaned name, or a book's title and first author. Movies and shows are
 * matched by id alone and have none.
 */
export function nameKey(
	medium: Medium,
	title: string,
	author?: string,
): string | undefined {
	if (medium === "game") {
		return matchKey(cleanGameName(title)) || undefined;
	}
	if (medium === "book") {
		const key = matchKey(bareBookTitle(title));
		return key ? `${key}|${matchKey(author ?? "")}` : undefined;
	}
	return undefined;
}

/** Whether a title is in a consumed set: by Catalog id, then by name. */
export function isConsumed(
	set: Pick<ConsumedSet, "ids" | "names">,
	medium: Medium,
	title: { catalogId: string; title: string; author?: string },
): boolean {
	if (set.ids.includes(title.catalogId)) {
		return true;
	}
	const key = nameKey(medium, title.title, title.author);
	return key !== undefined && set.names.includes(key);
}
