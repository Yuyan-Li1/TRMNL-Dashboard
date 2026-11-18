import { pickSearchResult, searchTrakt } from "@/lib/api/trakt";
import {
	findGame,
	type IgdbCredentials,
	IgdbTokenRejectedError,
	requestIgdbToken,
} from "@/lib/igdb/client";
import { type Database, getMeta, setMeta } from "../db";
import { findBook } from "../goodreads/search";
import type { FindInCatalog } from "./merge";

const IGDB_TOKEN_KEY = "igdb:token";
/** Renew the token this long before Twitch expires it. */
const TOKEN_RENEWAL_MARGIN_MS = 24 * 60 * 60 * 1000;

interface StoredToken {
	token: string;
	expiresAt: string;
}

/**
 * The Twitch app token, kept in the record: Vercel's copy is in a Redis key
 * the Collector may not write.
 */
async function igdbCredentials(db: Database): Promise<IgdbCredentials> {
	const clientId = process.env.TWITCH_CLIENT_ID;
	const clientSecret = process.env.TWITCH_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error(
			"TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET is not set in the Collector's .env",
		);
	}
	const stored = getMeta(db, IGDB_TOKEN_KEY);
	if (stored) {
		const { token, expiresAt } = JSON.parse(stored) as StoredToken;
		if (new Date(expiresAt).getTime() - TOKEN_RENEWAL_MARGIN_MS > Date.now()) {
			return { clientId, token };
		}
	}
	const { token, expiresInSeconds } = await requestIgdbToken(
		clientId,
		clientSecret,
	);
	setMeta(
		db,
		IGDB_TOKEN_KEY,
		JSON.stringify({
			token,
			expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
		} satisfies StoredToken),
	);
	return { clientId, token };
}

/**
 * The Catalogs as the Collector asks them: IGDB for a game, Trakt search for
 * a movie or show (TMDB is never called from the home server), Goodreads
 * for a book.
 */
export function catalogs(db: Database): FindInCatalog {
	return async (medium, query) => {
		if (medium === "book") {
			return findBook(query.title, query.author);
		}
		if (medium === "game") {
			try {
				const game = await findGame(await igdbCredentials(db), {
					name: query.title,
					steamAppId: query.steamAppId,
					year: query.year,
				});
				return game?.id === undefined
					? null
					: { id: String(game.id), title: game.name };
			} catch (error) {
				if (error instanceof IgdbTokenRejectedError) {
					// Revoked early: the next tick gets a new one
					db.prepare("DELETE FROM meta WHERE key = ?").run(IGDB_TOKEN_KEY);
				}
				throw error;
			}
		}
		const found = pickSearchResult(await searchTrakt(medium, query.title), {
			medium,
			title: query.title,
			year: query.year,
		});
		return found?.tmdbId ? { id: found.tmdbId, title: found.title } : null;
	};
}
