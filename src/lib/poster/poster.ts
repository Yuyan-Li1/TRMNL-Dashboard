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

/** A stored poster is rebuilt after this long even if its source is unchanged. */
const POSTER_TTL_SECONDS = 30 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 10_000;

function posterKey(sourceUrl: string, target: PosterTarget): string {
	const hash = createHash("sha256").update(sourceUrl).digest("hex");
	return `poster:${target}:${hash}`;
}

/**
 * Get the dithered poster for a source image, for the Spotlight or a
 * thumbnail. Runs during the refresh, never at render time. The result is
 * kept in Redis keyed by source URL and target, so a title's poster is made
 * once and reused until its source URL changes.
 */
export async function getPoster(
	sourceUrl: string,
	target: PosterTarget,
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
	await redis.set(key, poster, { ex: POSTER_TTL_SECONDS });
	return poster;
}
