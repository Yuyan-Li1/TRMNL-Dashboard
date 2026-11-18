import { CACHE_TTL, getRedis } from "@/lib/cache/redis";

/**
 * TMDB, the Catalog for movies. Its terms require the attribution notice and
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

/** A stored lookup; `movie` is null when TMDB does not have the id. */
interface StoredLookup {
	movie: CatalogMovie | null;
}

/** The parts of a TMDB movie the screen uses. */
export function toCatalogMovie(movie: TmdbMovie): CatalogMovie {
	const catalog: CatalogMovie = {};
	if (movie.poster_path) {
		catalog.posterUrl = `${POSTER_URL}${movie.poster_path}`;
	}
	if (movie.overview) {
		catalog.overview = movie.overview;
	}
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
	// With no votes, TMDB's average is a meaningless 0
	if (movie.vote_average !== undefined && (movie.vote_count ?? 0) > 0) {
		// Out of ten, to five stars in half-star steps
		catalog.rating = Math.round(movie.vote_average) / 2;
	}
	return catalog;
}

async function fetchMovie(tmdbId: string): Promise<TmdbMovie | null> {
	const key = process.env.TMDB_API_KEY;
	if (!key) {
		throw new Error("TMDB_API_KEY not configured");
	}

	const url = new URL(`${TMDB_URL}/movie/${encodeURIComponent(tmdbId)}`);
	url.searchParams.set("append_to_response", "credits");
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
	return (await response.json()) as TmdbMovie;
}

/**
 * Look a movie up in TMDB by the id the Letterboxd feed carries. The answer
 * is kept in Redis, a miss for a day and a match for a month.
 */
export async function lookupMovie(
	tmdbId: string,
): Promise<CatalogMovie | null> {
	const redis = getRedis();
	const key = `tmdb:movie:${tmdbId}`;
	const stored = await redis.get<StoredLookup>(key);
	if (stored) {
		return stored.movie;
	}

	const found = await fetchMovie(tmdbId);
	const movie = found ? toCatalogMovie(found) : null;
	await redis.set(key, { movie } satisfies StoredLookup, {
		ex: movie ? CACHE_TTL.TMDB_LOOKUP : NO_MATCH_TTL_SECONDS,
	});
	return movie;
}
