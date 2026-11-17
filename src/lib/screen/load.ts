import type { DashboardData } from "@/lib/api/refresh";
import { CACHE_KEYS, cacheGet, getRedis } from "@/lib/cache/redis";
import { readPoster } from "@/lib/poster/poster";
import { gamesContent } from "./games";
import { pickSpotlight } from "./spotlight";
import {
	MEDIUMS,
	type MediumCardView,
	type MediumContent,
	type ScreenView,
} from "./types";

/**
 * Load what the screen shows and pick the Spotlight. Called on every render
 * of the dashboard page. Reads Redis only: never a source or a Catalog.
 */
export async function loadScreen(): Promise<ScreenView> {
	const now = new Date();
	const redis = getRedis();

	const [fresh, previousId] = await Promise.all([
		cacheGet<DashboardData>(CACHE_KEYS.DASHBOARD_DATA),
		redis.get<string>(CACHE_KEYS.SPOTLIGHT_PREVIOUS),
	]);
	// Fall back to the non-expiring copy: stale but never missing
	const data =
		fresh ??
		(await cacheGet<DashboardData>(`${CACHE_KEYS.DASHBOARD_DATA}:latest`));

	// A medium whose stage has not shipped contributes nothing
	const contents: MediumContent[] = [
		gamesContent(data?.gaming?.games ?? [], now),
	];

	const picked = pickSpotlight({
		eligible: contents.flatMap((content) => content.eligible),
		fallback: contents.flatMap((content) => content.fallback),
		previousId: previousId ?? undefined,
		now,
	});
	if (picked && picked.id !== previousId) {
		await redis.set(CACHE_KEYS.SPOTLIGHT_PREVIOUS, picked.id);
	}

	const cardMediums = MEDIUMS.filter((medium) => medium !== picked?.medium);
	const [poster, cards] = await Promise.all([
		picked ? readPoster(picked.posterUrl, "spotlight") : null,
		Promise.all(
			cardMediums.map(async (medium): Promise<MediumCardView> => {
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
		now: now.toISOString(),
	};
}
