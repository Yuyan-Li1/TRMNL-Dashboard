# Preparing dark artwork for the 2-bit panel

Type: research
Assignee: Yuyan Li
Status: resolved

## Question

How should a poster be prepared before dithering so that dark artwork stays legible on the TRMNL OG's four-grey panel?

Found by the on-device test in [Spotlight screen on 2-bit e-ink](11-spotlight-screen-on-2-bit-e-ink.md): a mostly dark poster (Perfect Days) lost its lower half to near-black, while a mid-tone one was clean. A photo of four swatches (#000, #555, #aaa, #fff) on the device measured roughly 0, 32, 107, 255 when stretched to the black and white swatches, so the panel's two greys sit much darker than the evenly spaced values the dithering assumed.

- What the four grey levels of this class of panel actually look like (reflectance or lightness), and whether TRMNL or others publish the values.
- Whether to dither against the panel's measured levels instead of evenly spaced ones, and in which space (gamma-encoded, linear light, or lightness).
- Tone preparation for dark images: adaptive gamma, black and white point, local contrast (CLAHE), and what e-ink projects settle on.
- Which dithering method suits four levels at 320x480 (Floyd-Steinberg, Atkinson, Stucki, blue noise, ordered), including how each treats large dark areas.
- Whether any of this must change for small thumbnails (64x96).

The answer should end with a recommended pipeline and the parameters to tune on the device.

## Answer

Full findings: `docs/research/dark-artwork-on-2-bit-panel.md` on branch `research/dark-artwork-on-2-bit-panel` (pushed, never merged). It includes pipeline code that ran on a synthetic image only. The recommendation was revised after the on-device tests in [Spotlight screen on 2-bit e-ink](11-spotlight-screen-on-2-bit-e-ink.md); the final choice between tunings is made there.

- **Grey levels**: no measured or recommended values are published. TRMNL and every project checked use the even #000, #555, #aaa, #fff. The panel is a Good Display GDEW075T7 / GDEY075T7; the firmware makes the greys by hand-tuned timing with tables chosen by temperature profile, and TRMNL says they are not guaranteed linear. The owner's swatch photo (about 0, 32, 107, 255) is the only measurement.
- **Palette values only select a level**: the device buckets each pixel into one of four levels, so the PNG keeps the even palette and the pipeline decides which pixels get which level.
- **Why the first test was dark**: `sharp`'s `.gamma()` is tone-neutral on its own, so the first posters got no lift. Do not use it for brightening; apply the lift as our own lookup table.
- **Recommended pipeline**: resize to exact pixels with a cover crop; greyscale; normalise clipping 0.5% at each end; adaptive gamma chosen so the mean reaches 0.5, brighten only, clamped at 2.6; sharpen with sigma 0.8; serpentine Floyd-Steinberg on encoded values to the four even levels; 4-colour palette PNG shown 1:1. No local contrast (CLAHE).
- **Why not panel levels by default**: a strong lift and dithering against the panel's darker greys are the same correction, so doing both lifts twice and looks flat. Dithering against panel levels without a lift stays too dark, because a faithful copy of a dark poster is dark.
- **Dithering method**: Floyd-Steinberg with serpentine scanning keeps lettering and faces. Atkinson loses detail in dark and light areas; ordered (Bayer) dithering is unsuitable. Burkes or Sierra are the alternatives if worm patterns show.
- **Thumbnails** (inferred, untested): make each from the source, not from the large poster, with the same lift, a lighter sharpen (sigma 0.6) and 75% of the error passed on.
- **Ghosting**: grey specks in white areas are ghosting. TRMNL documents it as worse on firmware 1.8.18; 2-bit images already get a full refresh, so the "Full Refresh When the Screen Changes" setting changes little. Nothing is confirmed to remove it.
- **Unverified**: the panel's real reflectances; whether the gamma finding applies to this repo's sharp 0.34.5; the default rests on one dark poster at 188x282.
