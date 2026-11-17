// PROTOTYPE, throwaway. Downloads real artwork and dithers it to the four
// TRMNL greys for the Spotlight screen prototype.
// Run: node scripts/prototype-spotlight-dither.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// sharp is only a transitive dependency (via next), so resolve it through next.
const sharp = require(
	require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }),
);

const OUT = path.resolve("public/prototype/spotlight");
const UA = "media-dashboard-prototype/0.1";
const wiki = (p) => `https://upload.wikimedia.org/wikipedia/en/${p}`;
const steam = (id) =>
	`https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900_2x.jpg`;

const ART = {
	silksong: steam(1030300),
	"hades-2": steam(1145350),
	"perfect-days": wiki("c/c9/Perfect_Days_poster.jpg"),
	"dune-2": wiki("5/52/Dune_Part_Two_poster.jpeg"),
	sinners: wiki("5/5f/Sinners_%282025_film%29_poster.jpg"),
	severance: "https://static.tvmaze.com/uploads/images/original_untouched/548/1371406.jpg",
	pluribus: "https://static.tvmaze.com/uploads/images/original_untouched/592/1481086.jpg",
	"the-bear": "https://static.tvmaze.com/uploads/images/original_untouched/629/1574642.jpg",
	piranesi: "https://covers.openlibrary.org/b/id/10226290-L.jpg",
	"project-hail-mary": "https://covers.openlibrary.org/b/id/11200092-L.jpg",
};

// name -> [width, height]
const SIZES = { full: [320, 480], mid: [224, 336], thumb: [64, 96] };
const LEVELS = [0, 85, 170, 255]; // #000 #555 #aaa #fff

// fit "inside" keeps the artwork's own aspect ratio; "cover" crops to the box.
async function grey(buf, w, h, fit = "cover") {
	return sharp(buf)
		.resize(w, h, { fit, position: "attention" })
		.greyscale()
		.normalise()
		.gamma(1.6) // lift mid-tones: e-ink greys read darker than a monitor's
		.sharpen({ sigma: 0.8 })
		.raw()
		.toBuffer({ resolveWithObject: true });
}

function quantise(v) {
	return LEVELS[Math.max(0, Math.min(3, Math.round(v / 85)))];
}

function floydSteinberg(px, w, h) {
	const f = Float32Array.from(px);
	const out = Buffer.alloc(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			const q = quantise(f[i]);
			const e = f[i] - q;
			out[i] = q;
			if (x + 1 < w) f[i + 1] += (e * 7) / 16;
			if (y + 1 < h) {
				if (x > 0) f[i + w - 1] += (e * 3) / 16;
				f[i + w] += (e * 5) / 16;
				if (x + 1 < w) f[i + w + 1] += (e * 1) / 16;
			}
		}
	}
	return out;
}

async function png(raw, w, h, file) {
	const buf = await sharp(raw, { raw: { width: w, height: h, channels: 1 } })
		.png({ palette: true, colours: 4, compressionLevel: 9 })
		.toBuffer();
	await writeFile(path.join(OUT, file), buf);
	return buf.length;
}

await mkdir(OUT, { recursive: true });
const thumbs = {}; // slug -> [width, height] of the uncropped thumbnail
for (const [slug, url] of Object.entries(ART)) {
	const res = await fetch(url, { headers: { "User-Agent": UA } });
	if (!res.ok) {
		console.error(`FAILED ${slug}: ${res.status}`);
		continue;
	}
	const src = Buffer.from(await res.arrayBuffer());
	const sizes = [];
	for (const [name, [w, h]] of Object.entries(SIZES)) {
		const { data: g, info } = await grey(src, w, h, name === "thumb" ? "inside" : "cover");
		if (name === "thumb") thumbs[slug] = [info.width, info.height];
		const bytes = await png(floydSteinberg(g, info.width, info.height), info.width, info.height, `${slug}-${name}.png`);
		sizes.push(`${name} ${info.width}x${info.height} ${bytes}b`);
	}
	console.log(slug, sizes.join(", "));

	// Device test assets (research checklist item 3), one title only.
	if (slug === "severance") {
		const [w, h] = SIZES.mid;
		await sharp(src).resize(w, h, { fit: "cover" }).jpeg({ quality: 90 }).toFile(
			path.join(OUT, "test-colour.jpg"),
		);
		const { data: g } = await grey(src, w, h);
		await png(Buffer.from(g.map(quantise)), w, h, "test-posterised.png");
	}
}
await writeFile(
	path.resolve("src/app/(dashboard)/prototype/spotlight/thumbs.json"),
	`${JSON.stringify(thumbs, null, "\t")}\n`,
);
