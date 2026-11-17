import type { Poster } from "@/lib/poster/poster";

/**
 * A dithered poster, embedded as a data URI and shown pixel for pixel.
 * `next/image` is not used: it would resample the four greys.
 */
export function PosterImage({ poster }: { poster: Poster }): React.JSX.Element {
	return (
		<img
			src={poster.dataUri}
			width={poster.width}
			height={poster.height}
			alt=""
			className="block flex-none [image-rendering:pixelated]"
		/>
	);
}
