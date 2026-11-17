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
// ---- Tuning test (variant P): four ways to prepare a dark poster. ----
// The panel's greys measured from a photo of swatches: about 0, 32, 107, 255,
// much darker than the evenly spaced 0, 85, 170, 255 assumed above.
const PANEL = [0, 40, 110, 255];

async function base(buf, w, h) {
	return sharp(buf).resize(w, h, { fit: "cover", position: "attention" }).greyscale().normalise();
}

// Pick the gamma that brings the mean to `target` (0-1), then apply it.
function adaptiveGamma(px, target) {
	const mean = (g) => px.reduce((a, v) => a + (v / 255) ** (1 / g), 0) / px.length;
	let lo = 1; // never darken
	let hi = 2.6;
	for (let i = 0; i < 20; i++) {
		const mid = (lo + hi) / 2;
		if (mean(mid) < target) lo = mid;
		else hi = mid;
	}
	const g = (lo + hi) / 2;
	return { g, px: Float32Array.from(px, (v) => 255 * (v / 255) ** (1 / g)) };
}

// Error diffusion against the levels the panel really shows; output stays
// the four evenly spaced values TRMNL expects.
function ditherTo(px, w, h, levels) {
	const f = Float32Array.from(px);
	const out = Buffer.alloc(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			let k = 0;
			for (let n = 1; n < 4; n++) if (Math.abs(f[i] - levels[n]) < Math.abs(f[i] - levels[k])) k = n;
			const e = f[i] - levels[k];
			out[i] = LEVELS[k];
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

const TW = 188;
const TH = 282;
for (const slug of ["perfect-days", "dune-2", "silksong", "piranesi"]) {
	const res = await fetch(ART[slug], { headers: { "User-Agent": UA } });
	const src = Buffer.from(await res.arrayBuffer());
	const plain = await (await base(src, TW, TH)).sharpen({ sigma: 0.8 }).raw().toBuffer();
	const local = await (await base(src, TW, TH))
		.clahe({ width: 47, height: 47, maxSlope: 3 })
		.sharpen({ sigma: 0.8 })
		.raw()
		.toBuffer();
	const a2 = adaptiveGamma(plain, 0.5);
	const a4 = adaptiveGamma(local, 0.45);
	const tunings = [
		(await grey(src, TW, TH)).data, // 1: as shipped in the first test
		a2.px, // 2: adaptive gamma only, even levels
		plain, // 3: panel levels only
		a4.px, // 4: local contrast + adaptive gamma + panel levels
	];
	const levels = [LEVELS, LEVELS, PANEL, PANEL];
	for (let t = 0; t < 4; t++) {
		await png(ditherTo(tunings[t], TW, TH, levels[t]), TW, TH, `${slug}-tune${t + 1}.png`);
	}
	console.log(slug, "tunings written; adaptive gammas", a2.g.toFixed(2), a4.g.toFixed(2));
}

await writeFile(
	path.resolve("src/app/(dashboard)/prototype/spotlight/thumbs.json"),
	`${JSON.stringify(thumbs, null, "\t")}\n`,
);
