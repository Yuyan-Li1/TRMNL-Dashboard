import { CACHE_TTL, getRedis } from "@/lib/cache/redis";

/**
 * TMDB, the Catalog for movies and shows. Its terms require the attribution notice and
 * logo on the page (see TmdbAttribution) and forbid keeping its data longer
 * than 6 months: everything derived from a lookup expires in Redis (see
 * `CACHE_TTL.TMDB_LOOKUP` and `CACHE_TTL.TMDB_DERIVED`).
 */
const TMDB_URL = "https://api.themoviedb.org/3";
const POSTER_URL = "https://image.tmdb.org/t/p/w780";
const NO_MATCH_TTL_SECONDS = 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 10_000;

/** What the Catalog says about a movie. */
export interface CatalogMovie {
	posterUrl?: string;
	overview?: string;
	/** The release year */
	year?: number;
	/** Every credited director, comma separated */
	director?: string;
	/** Public rating converted to five stars, in half-star steps */
	rating?: number;
}

interface TmdbMovie {
	title?: string;
	overview?: string | null;
	release_date?: string | null;
	poster_path?: string | null;
	vote_average?: number;
	vote_count?: number;
	credits?: { crew?: { job?: string; name?: string }[] };
}

/** What the Catalog says about a show. */
export interface CatalogShow {
	posterUrl?: string;
	overview?: string;
	/** Public rating converted to five stars, in half-star steps */
	rating?: number;
}

interface TmdbShow {
	name?: string;
	overview?: string | null;
	poster_path?: string | null;
	vote_average?: number;
	vote_count?: number;
}

/** A stored lookup; the title is null when TMDB does not have the id. */
interface StoredLookup<T> {
	title: T | null;
}

/** The poster, overview and rating, which a movie and a show both carry. */
function sharedDetails(title: TmdbMovie | TmdbShow): CatalogShow {
	const catalog: CatalogShow = {};
	if (title.poster_path) {
		catalog.posterUrl = `${POSTER_URL}${title.poster_path}`;
	}
	if (title.overview) {
		catalog.overview = title.overview;
	}
	// With no votes, TMDB's average is a meaningless 0
	if (title.vote_average !== undefined && (title.vote_count ?? 0) > 0) {
		// Out of ten, to five stars in half-star steps
		catalog.rating = Math.round(title.vote_average) / 2;
	}
	return catalog;
}

/** The parts of a TMDB movie the screen uses. */
export function toCatalogMovie(movie: TmdbMovie): CatalogMovie {
	const catalog: CatalogMovie = sharedDetails(movie);
	const year = Number(movie.release_date?.slice(0, 4));
	if (Number.isInteger(year) && year > 0) {
		catalog.year = year;
	}
	const directors = (movie.credits?.crew ?? [])
		.filter((member) => member.job === "Director" && member.name)
		.map((member) => member.name);
	if (directors.length > 0) {
		catalog.director = directors.join(", ");
	}
	return catalog;
}

/** The parts of a TMDB show the screen uses. */
export function toCatalogShow(show: TmdbShow): CatalogShow {
	return sharedDetails(show);
}

/** Ask TMDB for one title. Null when it does not have the id. */
async function tmdbGet<T>(
	path: string,
	params: Record<string, string> = {},
): Promise<T | null> {
	const key = process.env.TMDB_API_KEY;
	if (!key) {
		throw new Error("TMDB_API_KEY not configured");
	}

	const url = new URL(`${TMDB_URL}${path}`);
	for (const [name, value] of Object.entries(params)) {
		url.searchParams.set(name, value);
	}
	const headers: Record<string, string> = { Accept: "application/json" };
	// TMDB issues two credentials: a short API key sent as a parameter and a
	// long "read access token" sent as a bearer token. Either works here.
	if (key.startsWith("eyJ")) {
		headers.Authorization = `Bearer ${key}`;
	} else {
		url.searchParams.set("api_key", key);
	}

	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		// The URL may carry the key, so it is kept out of the message
		throw new Error(`TMDB request failed: ${response.status}`);
	}
	return (await response.json()) as T;
}

/**
 * Look a title up, keeping the answer in Redis: a miss for a day and a match
 * for a month.
 */
async function lookup<T>(
	key: string,
	find: () => Promise<T | null>,
): Promise<T | null> {
	const redis = getRedis();
	const stored = await redis.get<StoredLookup<T>>(key);
	// A lookup stored in an earlier shape has no `title` and is asked again
	if (stored && "title" in stored) {
		return stored.title;
	}

	const title = await find();
	await redis.set(key, { title } satisfies StoredLookup<T>, {
		ex: title ? CACHE_TTL.TMDB_LOOKUP : NO_MATCH_TTL_SECONDS,
	});
	return title;
}

/** Look a movie up in TMDB by the id the Letterboxd feed carries. */
export async function lookupMovie(
	tmdbId: string,
): Promise<CatalogMovie | null> {
	return lookup(`tmdb:movie:${tmdbId}`, async () => {
		const found = await tmdbGet<TmdbMovie>(
			`/movie/${encodeURIComponent(tmdbId)}`,
			{ append_to_response: "credits" },
		);
		return found ? toCatalogMovie(found) : null;
	});
}

/** Look a show up in TMDB by the id Trakt returns for it. */
export async function lookupShow(tmdbId: number): Promise<CatalogShow | null> {
	return lookup(`tmdb:show:${tmdbId}`, async () => {
		const found = await tmdbGet<TmdbShow>(`/tv/${tmdbId}`);
		return found ? toCatalogShow(found) : null;
	});
}
