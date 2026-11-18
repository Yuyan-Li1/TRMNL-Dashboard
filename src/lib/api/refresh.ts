import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGetLatest,
	cacheSet,
	getRedis,
} from "@/lib/cache/redis";
import { alertRedisUnreachable, sendAlerts } from "@/lib/health/alert";
import { NPSSO_LIFETIME_DAYS } from "@/lib/health/checks";
import { collectReads } from "@/lib/health/reads";
import {
	fingerprint,
	readRefreshStatus,
	updateStatus,
	writeRefreshStatus,
} from "@/lib/health/status";
import { addDays, ownerDay } from "@/lib/owner-day";
import type { GamingData } from "@/types/gaming";
import type { MoviesData } from "@/types/movies";
import type { ShowsData } from "@/types/shows";
import { getGamingData } from "./gaming";
import { getMoviesData } from "./movies";
import { getShowsData } from "./shows";

export interface DashboardData {
	gaming: GamingData | null;
	/** Absent in data stored before movies were read */
	movies?: MoviesData | null;
	/** Absent in data stored before shows were read */
	shows?: ShowsData | null;
	errors: string[];
	refreshedAt: string;
}

/**
 * Refresh every source, store the combined result in Redis, keep the
 * refresh's bookkeeping (its last success and each source's health) and
 * send the Alerts it calls for. Called by the refresh API endpoints.
 */
export async function refreshAllData(): Promise<DashboardData> {
	try {
		const { result, reads } = await collectReads(readAndStore);

		const now = new Date();
		const previous = await readRefreshStatus();
		const status = updateStatus(
			previous,
			{ reads, npsso: await configuredNpsso(!previous?.npsso) },
			now,
		);
		await writeRefreshStatus(status);
		await sendAlerts(status, now);

		return result;
	} catch (error) {
		// At most one message per refresh: with Redis down nothing remembers
		// that it was sent
		if (!(await isRedisReachable())) {
			await alertRedisUnreachable();
		}
		throw error;
	}
}

/**
 * The PSN token now configured. The first time it is seen, the day it was
 * set is taken from the expiry time once kept beside the PSN refresh token,
 * so a token already weeks old is not dated from today.
 */
async function configuredNpsso(
	firstSeen: boolean,
): Promise<{ fingerprint: string; knownSince?: string } | undefined> {
	const npsso = process.env.PSN_NPSSO;
	if (!npsso) {
		return undefined;
	}
	const configured: { fingerprint: string; knownSince?: string } = {
		fingerprint: fingerprint(npsso),
	};
	if (firstSeen) {
		const stored = await getRedis().get<{ npssoExpiresAt?: string }>(
			CACHE_KEYS.PSN_AUTH,
		);
		if (stored?.npssoExpiresAt) {
			configured.knownSince = addDays(
				ownerDay(new Date(stored.npssoExpiresAt)),
				-NPSSO_LIFETIME_DAYS,
			);
		}
	}
	return configured;
}

async function isRedisReachable(): Promise<boolean> {
	try {
		await getRedis().ping();
		return true;
	} catch {
		return false;
	}
}

async function readAndStore(): Promise<DashboardData> {
	const errors: string[] = [];
	let lastGood: Promise<DashboardData | null> | undefined;

	/**
	 * Read one Medium. When it fails altogether its last good data stays on
	 * screen: stale but never missing.
	 */
	async function read<T extends { errors: string[] }>(
		name: string,
		get: () => Promise<T>,
		stored: (data: DashboardData) => T | null | undefined,
	): Promise<T | null> {
		try {
			const data = await get();
			errors.push(...data.errors);
			return data;
		} catch (error) {
			errors.push(`${name}: ${error}`);
			console.error(`${name} fetch failed:`, error);
			lastGood ??= cacheGetLatest<DashboardData>(
				CACHE_KEYS.DASHBOARD_DATA,
			).catch(() => null);
			const data = await lastGood;
			return (data && stored(data)) ?? null;
		}
	}

	const [gaming, readMovies, readShows] = await Promise.all([
		read("Gaming", getGamingData, (data) => data.gaming),
		read("Movies", getMoviesData, (data) => data.movies),
		read("Shows", getShowsData, (data) => data.shows),
	]);

	// TMDB's text may not be kept for ever. The copy that otherwise never
	// expires lives only as long as the movies and shows in it may still be
	// kept, and those carried over from the last good data are dropped once
	// too old.
	const secondsLeft = (data: { fetchedAt: string }): number =>
		CACHE_TTL.TMDB_DERIVED -
		Math.floor((Date.now() - new Date(data.fetchedAt).getTime()) / 1000);
	const movies = readMovies && secondsLeft(readMovies) > 0 ? readMovies : null;
	const shows = readShows && secondsLeft(readShows) > 0 ? readShows : null;
	const withTmdbData = [movies, shows].filter((data) => data !== null);
	const latestTtlSeconds =
		withTmdbData.length > 0
			? Math.min(...withTmdbData.map(secondsLeft))
			: undefined;

	const dashboardData: DashboardData = {
		gaming,
		movies,
		shows,
		errors,
		refreshedAt: new Date().toISOString(),
	};

	await cacheSet(
		CACHE_KEYS.DASHBOARD_DATA,
		dashboardData,
		CACHE_TTL.DASHBOARD_DATA,
		latestTtlSeconds,
	);

	return dashboardData;
}
