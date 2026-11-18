import type { DashboardData } from "@/lib/api/refresh";
import { CACHE_KEYS, cacheGetOrLatest, getRedis } from "@/lib/cache/redis";
import type { PoolRecord, PoolTitles } from "@/lib/picks/pool";
import { readPoster } from "@/lib/poster/poster";
import { booksContent } from "./books";
import { gamesContent } from "./games";
import { moviesContent } from "./movies";
import { picksContent, poolPickId } from "./picks";
import { showsContent } from "./shows";
import { pickSpotlight } from "./spotlight";
import {
	MEDIA,
	type MediumCardView,
	type MediumContent,
	type ScreenView,
} from "./types";

interface LoadScreenOptions {
	/**
	 * Keep the pick as the previous Spotlight. Off for the admin preview, so
	 * looking at it does not change what the device shows next.
	 */
	rememberPick?: boolean;
}

/**
 * Load what the screen shows and pick the Spotlight. Called on every render
 * of the dashboard page. Reads Redis only: never a source or a Catalog.
 */
export async function loadScreen({
	rememberPick = true,
}: LoadScreenOptions = {}): Promise<ScreenView> {
	const now = new Date();
	const redis = getRedis();

	const [data, previousId, pool, poolTitles] = await Promise.all([
		cacheGetOrLatest<DashboardData>(CACHE_KEYS.DASHBOARD_DATA),
		redis.get<string>(CACHE_KEYS.SPOTLIGHT_PREVIOUS),
		redis.get<PoolRecord>(CACHE_KEYS.POOL_RECORD),
		redis.get<PoolTitles>(CACHE_KEYS.POOL_TITLES),
	]);

	// A medium with no data yet contributes nothing
	const contents: MediumContent[] = [
		gamesContent(data?.gaming?.games ?? [], now),
		moviesContent(data?.movies?.movies ?? [], now),
		showsContent(data?.shows?.shows ?? [], now),
		booksContent(data?.books?.books ?? [], now),
	];

	// The Recommendation Mode takes its share once any pick exists
	const recommendations = picksContent(pool?.picks ?? [], poolTitles ?? {});

	const picked = pickSpotlight({
		eligible: [
			...contents.flatMap((content) => content.eligible),
			...recommendations,
		],
		fallback: contents.flatMap((content) => content.fallback),
		previousId: previousId ?? undefined,
		now,
	});
	if (rememberPick && picked && picked.id !== previousId) {
		await redis.set(CACHE_KEYS.SPOTLIGHT_PREVIOUS, picked.id);
	}
	// A pick leaves the Pool after 3 Spotlight appearances: each is counted
	const appeared = picked && poolPickId(picked);
	if (rememberPick && appeared) {
		await redis.hincrby(CACHE_KEYS.POOL_APPEARANCES, appeared, 1);
	}

	const cardMedia = MEDIA.filter((medium) => medium !== picked?.medium);
	const [poster, cards] = await Promise.all([
		picked ? readPoster(picked.posterUrl, "spotlight") : null,
		Promise.all(
			cardMedia.map(async (medium): Promise<MediumCardView> => {
				const latest =
					contents.find((content) => content.medium === medium)?.latest ?? null;
				if (!latest) {
					return { medium, activity: null };
				}
				const thumbnail = latest.thumbnailUrl
					? await readPoster(latest.thumbnailUrl, "thumbnail")
					: null;
				return { medium, activity: { ...latest, thumbnail } };
			}),
		),
	]);

	return {
		spotlight: picked ? { ...picked, poster } : null,
		cards,
	};
}
