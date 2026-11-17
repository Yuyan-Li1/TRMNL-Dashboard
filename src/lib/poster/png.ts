import { deflateSync } from "node:zlib";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const out = Buffer.alloc(body.length + 8);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body), body.length + 4);
	return out;
}

/**
 * Encode a 2-bit palette PNG. `indices` holds one palette index (0-3) per
 * pixel; `palette` holds the four grey values the indices stand for.
 */
export function encodeFourGreyPng(
	indices: Uint8Array,
	width: number,
	height: number,
	palette: readonly [number, number, number, number],
): Buffer {
	const rowBytes = Math.ceil(width / 4);
	const raw = Buffer.alloc((rowBytes + 1) * height);
	for (let y = 0; y < height; y++) {
		const rowStart = y * (rowBytes + 1) + 1; // byte 0 of each row: filter "none"
		for (let x = 0; x < width; x++) {
			raw[rowStart + (x >> 2)] |= indices[y * width + x] << (6 - 2 * (x & 3));
		}
	}

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 2; // bit depth
	header[9] = 3; // colour type: palette

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("PLTE", Buffer.from(palette.flatMap((grey) => [grey, grey, grey]))),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}
