import sharp from "sharp";
import { encodeFourGreyPng } from "./png";

/** The four even greys the TRMNL "4 grays 2 bit" palette expects. */
const GREYS = [0, 85, 170, 255] as const;

/** The brightness lift: the mean it aims for and the strongest curve allowed. */
const LIFT_TARGET_MEAN = 0.45;
const LIFT_MAX_GAMMA = 2.6;

interface PosterRecipe {
	width: number;
	height: number;
	/** "cover" crops to the exact size; "inside" keeps the artwork's shape. */
	fit: "cover" | "inside";
	sharpenSigma: number;
	/** Share of the dithering error passed on to neighbouring pixels. */
	errorShare: number;
}

export const POSTER_TARGETS = {
	spotlight: {
		width: 320,
		height: 480,
		fit: "cover",
		sharpenSigma: 0.8,
		errorShare: 1,
	},
	thumbnail: {
		width: 64,
		height: 96,
		fit: "inside",
		sharpenSigma: 0.6,
		errorShare: 0.75,
	},
} as const satisfies Record<string, PosterRecipe>;

export type PosterTarget = keyof typeof POSTER_TARGETS;

export interface RenderedPoster {
	png: Buffer;
	width: number;
	height: number;
}

/**
 * Build the lookup table that brightens an image so its mean reaches the
 * target. It never darkens (gamma starts at 1) and is capped at the maximum.
 * `sharp`'s own `.gamma()` does not brighten, hence our own curve.
 */
function liftCurve(pixels: Uint8Array): Float32Array {
	const histogram = new Uint32Array(256);
	for (const value of pixels) {
		histogram[value]++;
	}
	const meanAt = (gamma: number): number => {
		let sum = 0;
		for (let value = 0; value < 256; value++) {
			sum += histogram[value] * (value / 255) ** (1 / gamma);
		}
		return sum / pixels.length;
	};

	let low = 1;
	let high = LIFT_MAX_GAMMA;
	for (let step = 0; step < 20; step++) {
		const middle = (low + high) / 2;
		if (meanAt(middle) < LIFT_TARGET_MEAN) {
			low = middle;
		} else {
			high = middle;
		}
	}
	const gamma = meanAt(1) >= LIFT_TARGET_MEAN ? 1 : (low + high) / 2;

	return Float32Array.from(
		{ length: 256 },
		(_, value) => 255 * (value / 255) ** (1 / gamma),
	);
}

function toLinear(value: number): number {
	const c = Math.max(0, Math.min(1, value / 255));
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Serpentine Floyd-Steinberg in linear light. Returns one index into GREYS
 * per pixel.
 */
function dither(
	pixels: Float32Array,
	width: number,
	height: number,
	errorShare: number,
): Uint8Array {
	const levels = GREYS.map(toLinear);
	const light = Float32Array.from(pixels, toLinear);
	const out = new Uint8Array(width * height);

	for (let y = 0; y < height; y++) {
		const direction = y % 2 === 0 ? 1 : -1;
		for (let n = 0; n < width; n++) {
			const x = direction === 1 ? n : width - 1 - n;
			const i = y * width + x;

			let nearest = 0;
			for (let level = 1; level < levels.length; level++) {
				if (
					Math.abs(light[i] - levels[level]) <
					Math.abs(light[i] - levels[nearest])
				) {
					nearest = level;
				}
			}
			out[i] = nearest;

			const error = (light[i] - levels[nearest]) * errorShare;
			const ahead = x + direction;
			const behind = x - direction;
			const hasAhead = ahead >= 0 && ahead < width;
			const hasBehind = behind >= 0 && behind < width;
			if (hasAhead) light[i + direction] += (error * 7) / 16;
			if (y + 1 < height) {
				if (hasBehind) light[i + width - direction] += (error * 3) / 16;
				light[i + width] += (error * 5) / 16;
				if (hasAhead) light[i + width + direction] += (error * 1) / 16;
			}
		}
	}
	return out;
}

/**
 * Turn source artwork into a four-grey PNG for the e-ink panel:
 * resize, greyscale, normalise, lift, sharpen, dither.
 */
export async function renderPoster(
	source: Buffer,
	target: PosterTarget,
): Promise<RenderedPoster> {
	const recipe = POSTER_TARGETS[target];
	const { data, info } = await sharp(source)
		.resize(recipe.width, recipe.height, {
			fit: recipe.fit,
			position: "attention",
		})
		.flatten({ background: "#ffffff" })
		.greyscale()
		.normalise({ lower: 0.5, upper: 99.5 })
		.raw()
		.toBuffer({ resolveWithObject: true });

	const curve = liftCurve(data);
	const lifted = Buffer.from(data.map((value) => Math.round(curve[value])));

	// A second pass, because sharp applies its operations in its own fixed
	// order (sharpen before normalise) whatever order they are called in.
	const sharpened = await sharp(lifted, {
		raw: { width: info.width, height: info.height, channels: 1 },
	})
		.sharpen({ sigma: recipe.sharpenSigma })
		// Without this sharp hands back three channels for one-channel input.
		.toColourspace("b-w")
		.raw()
		.toBuffer();
	if (sharpened.length !== info.width * info.height) {
		throw new Error("Poster pixels are not one channel per pixel");
	}

	const indices = dither(
		Float32Array.from(sharpened),
		info.width,
		info.height,
		recipe.errorShare,
	);

	return {
		png: encodeFourGreyPng(indices, info.width, info.height, GREYS),
		width: info.width,
		height: info.height,
	};
}
