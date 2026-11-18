import { createHash } from "node:crypto";
import { getRedis } from "@/lib/cache/redis";
import { type PosterTarget, renderPoster } from "./render";

/** A dithered poster as the page embeds it. */
export interface Poster {
	sourceUrl: string;
	width: number;
	height: number;
	/** The four-grey PNG as a `data:` URI. */
	dataUri: string;
}

const FETCH_TIMEOUT_MS = 10_000;

/** Bump when the recipe's output changes, so stored posters are redone. */
const RECIPE_VERSION = 3;

function posterKey(sourceUrl: string, target: PosterTarget): string {
	const hash = createHash("sha256").update(sourceUrl).digest("hex");
	return `poster:v${RECIPE_VERSION}:${target}:${hash}`;
}

/**
 * Read a stored poster without making one. This is what the page uses: it
 * never fetches artwork while rendering.
 */
export async function readPoster(
	sourceUrl: string,
	target: PosterTarget,
): Promise<Poster | null> {
	return getRedis().get<Poster>(posterKey(sourceUrl, target));
}

/**
 * Get the dithered poster for a source image, for the Spotlight or a
 * thumbnail. Runs during the refresh, never at render time. The result is
 * kept in Redis keyed by source URL and target, so a title's poster is made
 * once and reused until its source URL changes. With `ttlSeconds` it is
 * dropped after that long and made again by the next refresh that wants it,
 * for artwork that may not be kept for ever.
 */
export async function getPoster(
	sourceUrl: string,
	target: PosterTarget,
	ttlSeconds?: number,
): Promise<Poster> {
	const redis = getRedis();
	const key = posterKey(sourceUrl, target);
	const stored = await redis.get<Poster>(key);
	if (stored) {
		return stored;
	}

	const response = await fetch(sourceUrl, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Artwork fetch failed: ${response.status} ${sourceUrl}`);
	}
	const rendered = await renderPoster(
		Buffer.from(await response.arrayBuffer()),
		target,
	);

	const poster: Poster = {
		sourceUrl,
		width: rendered.width,
		height: rendered.height,
		dataUri: `data:image/png;base64,${rendered.png.toString("base64")}`,
	};
	await (ttlSeconds === undefined
		? redis.set(key, poster)
		: redis.set(key, poster, { ex: ttlSeconds }));
	return poster;
}
