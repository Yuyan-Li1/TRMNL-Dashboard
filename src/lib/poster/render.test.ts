import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderPoster } from "./render";

const FOUR_GREYS = [0, 85, 170, 255];

/** A flat grey JPEG-free source image, as a PNG buffer. */
async function flatImage(
	width: number,
	height: number,
	grey: number,
): Promise<Buffer> {
	return sharp({
		create: {
			width,
			height,
			channels: 3,
			background: { r: grey, g: grey, b: grey },
		},
	})
		.png()
		.toBuffer();
}

/**
 * A left-to-right ramp between two greys, so normalise has a range to keep.
 * A `power` above 1 keeps most of the ramp near `from`.
 */
async function rampImage(
	width: number,
	height: number,
	from: number,
	to: number,
	power = 1,
): Promise<Buffer> {
	const data = Buffer.alloc(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			data[y * width + x] = Math.round(
				from + (to - from) * (x / (width - 1)) ** power,
			);
		}
	}
	return sharp(data, { raw: { width, height, channels: 1 } })
		.png()
		.toBuffer();
}

async function decode(
	png: Buffer,
): Promise<{ width: number; height: number; pixels: Buffer }> {
	const { data, info } = await sharp(png)
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { width: info.width, height: info.height, pixels: data };
}

function mean(pixels: Buffer): number {
	return pixels.reduce((sum, value) => sum + value, 0) / pixels.length / 255;
}

/** Mean in linear light, which is what the dithering preserves. */
function linearMean(pixels: Buffer): number {
	const toLinear = (value: number): number => {
		const c = value / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return (
		pixels.reduce((sum, value) => sum + toLinear(value), 0) / pixels.length
	);
}

describe("renderPoster", () => {
	it("fits a Spotlight poster inside 320x480 without cropping", async () => {
		const twoByThree = await renderPoster(
			await rampImage(600, 900, 0, 255),
			"spotlight",
		);
		const decoded = await decode(twoByThree.png);
		expect([twoByThree.width, twoByThree.height]).toEqual([320, 480]);
		expect([decoded.width, decoded.height]).toEqual([320, 480]);

		// An IGDB cover is 3:4, a little wider than the slot.
		const threeByFour = await renderPoster(
			await rampImage(528, 704, 0, 255),
			"spotlight",
		);
		expect([threeByFour.width, threeByFour.height]).toEqual([320, 427]);

		const square = await renderPoster(
			await rampImage(512, 512, 0, 255),
			"spotlight",
		);
		expect([square.width, square.height]).toEqual([320, 320]);
	});

	it("uses only the four even greys, in a 2-bit palette PNG", async () => {
		const poster = await renderPoster(
			await rampImage(640, 960, 0, 255),
			"spotlight",
		);
		const { pixels } = await decode(poster.png);
		const used = [...new Set(pixels)].sort((a, b) => a - b);
		expect(used).toEqual(FOUR_GREYS);
		// PNG header: bit depth at byte 24, colour type at byte 25
		expect(poster.png[24]).toBe(2);
		expect(poster.png[25]).toBe(3);
	});

	it("lifts a dark image towards a mean of 0.45", async () => {
		// Mostly dark: a ramp that stays near black for most of its width
		const dark = await rampImage(640, 960, 0, 255, 3);
		const before = mean((await decode(dark)).pixels);
		const after = mean(
			(await decode((await renderPoster(dark, "spotlight")).png)).pixels,
		);
		expect(before).toBeLessThan(0.3);
		expect(after).toBeGreaterThan(before + 0.1);
	});

	it("never darkens a light image", async () => {
		const light = await rampImage(640, 960, 128, 255);
		const normalised = await sharp(light)
			.resize(320, 480)
			.normalise({ lower: 0.5, upper: 99.5 })
			.raw()
			.toBuffer();
		const after = linearMean(
			(await decode((await renderPoster(light, "spotlight")).png)).pixels,
		);
		expect(after).toBeGreaterThan(linearMean(normalised) - 0.02);
	});

	it("fits a thumbnail inside 64x96 without cropping", async () => {
		const square = await renderPoster(
			await rampImage(512, 512, 0, 255),
			"thumbnail",
		);
		expect([square.width, square.height]).toEqual([64, 64]);

		const wide = await renderPoster(
			await rampImage(920, 430, 0, 255),
			"thumbnail",
		);
		expect([wide.width, wide.height]).toEqual([64, 30]);

		const tall = await renderPoster(
			await rampImage(600, 900, 0, 255),
			"thumbnail",
		);
		expect([tall.width, tall.height]).toEqual([64, 96]);
	});

	it("renders a flat image without failing", async () => {
		const poster = await renderPoster(
			await flatImage(400, 600, 255),
			"spotlight",
		);
		const { pixels } = await decode(poster.png);
		expect(mean(pixels)).toBeGreaterThan(0.95);
	});
});

describe("renderPoster geometry", () => {
	it("keeps the artwork's layout: a dark top half stays on top, a light bottom half below", async () => {
		const width = 320;
		const height = 480;
		const data = Buffer.alloc(width * height, 255);
		data.fill(0, 0, width * (height / 2));
		const source = await sharp(data, { raw: { width, height, channels: 1 } })
			.png()
			.toBuffer();

		const { png } = await renderPoster(source, "spotlight");
		const { pixels } = await decode(png);

		const topQuarter = pixels.subarray(0, width * (height / 4));
		const bottomQuarter = pixels.subarray(width * (height * 0.75));
		expect(mean(topQuarter)).toBeLessThan(0.05);
		expect(mean(bottomQuarter)).toBeGreaterThan(0.95);
	});
});
