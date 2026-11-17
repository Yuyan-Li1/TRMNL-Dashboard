# Research: keeping dark artwork legible on the TRMNL OG's four-grey panel

Researched 2026-11-17. Throwaway research branch, not for merge. Builds on `docs/research/trmnl-image-rendering.md` (branch `research/trmnl-image-rendering`) and does not repeat it.

**Question.** How should a poster be prepared before dithering so that dark artwork stays legible on a TRMNL OG in 2-bit mode (firmware 1.8.18, palette "4 grays 2 bit")?

**Evidence labels** used on every claim:

- **[DOC]** stated in official documentation or a first-party article (URL given; fetched 2026-11-17).
- **[SRC]** read from source code (repo, path, commit given).
- **[RAN]** observed by running code locally on 2026-11-17 (sharp 0.35.5, libvips 8.18.7, Node 22.20). Nothing was run on the device.
- **[INFER]** my reasoning from the facts above; no source states it.
- **[UNVERIFIED]** could not be established from a primary source.

## Short answer

1. **Nobody publishes measured grey levels for this panel.** TRMNL, Good Display and every community project found treat 2-bit as the evenly spaced values `#000 / #555 / #AAA / #FFF`. The firmware makes the two greys by timing voltage pushes, hand-tuned, with no reflectance target; TRMNL's own engineer writes that the greys are "not guaranteed to be linear". The phone measurement in the brief (0 / 32 / 107 / 255) is the only data there is for this device.
2. **Two separate things darken the poster today.** (a) Dithering assumes the greys sit at 85 and 170 when the panel shows something near 32 and 107, so every tone below light grey is rendered far too dark. (b) In sharp, `.gamma(1.6)` is not a shadow lift: on its own it is a tone-neutral round trip, and combined with a parameterless `.sharpen()` it **darkened** mid-tones in my test (128 became 85). Check this first; it may be most of the problem.
3. **Recommended pipeline:** resize, greyscale, percentile stretch, adaptive gamma towards a target mean (as a lookup table in JS, not `sharp.gamma`), sigma-form sharpen, then serpentine Floyd-Steinberg **in linear light against the panel's measured levels**, writing the PNG with the unchanged `#000/#555/#AAA/#FFF` palette. Starting values are in section 6.
4. **Method:** keep Floyd-Steinberg, add serpentine scanning. Atkinson is the wrong choice for this problem because it discards a quarter of the error, which is documented to lose detail in very dark and very light areas.
5. **Thumbnails:** same levels and tone curve, computed per thumbnail from the source image, with a slightly higher target mean and reduced error diffusion. No source covers this; it is inference to test on the device.

## 1. What the four grey levels actually look like

### Which panel it is

| Claim | Evidence |
| --- | --- |
| The OG's 7.5" panel is driven as Good Display `GDEW075T7` ("older version") or `GDEY075T7-D2` ("newer version"), with a third variant for an "older panel, darker grays needed". | [SRC] `bitbank2/bb_epaper` `src/bb_epaper.h` lines 240-242 at `8e26f00` (the commit pinned by firmware `main`) |
| GDEY075T7 is 800x480, UC8179 controller, "MAX GRAYSCALE 4". The product page gives no reflectance, contrast or per-grey figures, and says to contact the vendor for greyscale code. | [DOC] <https://www.good-display.com/product/396.html> |
| TRMNL's OG spec sheet lists "Grayscale: 4 levels" and "Contrast Ratio: 10:1". No panel model, no reflectance. | [DOC] <https://trmnl.com/products/og/spec-sheet> |
| TRMNL presents the OG as 1-bit "per our supplier's data sheets", true only "until you rewrite the LUTs (lookup tables) and unlock 4 levels". | [DOC] <https://trmnl.com/blog/no-more-flicker> |

### How the firmware produces the two greys

- The OG build (`DEVICE_MODEL "og"`) picks its 2-bit panel type from a table indexed by the server-set temperature profile: default profile uses `EP75_800x480_4GRAY`, profile A uses `EP75_800x480_4GRAY_GEN2`, profile B uses `EP75_800x480_4GRAY_V2`. [SRC] `usetrmnl/trmnl-firmware` `src/board_config.cpp` line 65 and `src/png_render.cpp` line 629 at `d5b610b` (main, version 1.8.20); the same table is in `src/display.cpp` lines 76-77 and 1759 at tag `v1.8.18` (`4ffa33a`).
- `EP75_800x480_4GRAY` and `_V2` load a custom waveform table into the UC8179 (registers 0x20 to 0x25). Each row is four 2-bit push directions plus frame counts. The two greys differ from black and white only in the last row, a short sequence of opposing pushes, for example `0x99, 0x11, 0x04, 0x06, 0x06`. The `_V2` table changes one of those rows to `0x99, 0x06, 0x10, 0x08, 0x03` and is commented "older model with too light output". `_GEN2` loads no table; it switches the newer panel into its built-in 4-grey mode (`0xe5, 0x5f`), so its greys come from the panel's factory waveform. [SRC] `bitbank2/bb_epaper` `src/bb_ep.inl` lines 3849-4063 at `8e26f00`. The three tables are byte-identical at `1a38d70`, the commit pinned by firmware 1.8.18 (compared by hash). [RAN]
- TRMNL's write-up of this work describes the greys as: dark grey is "fully toward black, then slightly toward white", light grey is "fully toward white, then slightly toward black". It says the greys "look reasonable" but are not guaranteed to be linear from white to black, for vendor and custom tables alike, that custom tables must match ambient temperature (one table works around 20 C, give or take 10), and that active pixels disturb idle neighbours, "which causes visible noise at the boundaries between different gray shades". [DOC] <https://trmnl.com/blog/custom-luts>
- "the exact shade of gray will vary from device to device". [DOC] <https://help.trmnl.com/en/articles/12386214-grayscale-1-bit-2-bit-4-bit-in-framework> (from the earlier note). Temperature profiles "adjust the panel's tuning"; the article does not say how they move the greys. [DOC] <https://help.trmnl.com/en/articles/12566040-tuning-a-washed-out-display>
- For the TRMNL X the firmware carries the comment "The generic 2-bit gray update procedure is too dark on the X's 10.3" panel", and re-maps 2-bit pixels onto a calibrated 4-bit path. That fix is X-only; the OG path has no equivalent. [SRC] `trmnl-firmware` `src/png_render.cpp` lines 354-373 at `d5b610b`
- So: the greys are set by push timing chosen by eye, there is a known "too light" and a known "too dark" case in first-party code, and no target lightness is recorded anywhere. Which of the three tables this device uses depends on its temperature profile setting, which I cannot see. [INFER] / [UNVERIFIED]

### How pixel values reach those greys

- On the device, any PNG that is palette-indexed or deeper than 2 bits is reduced with `3 ^ (g >> 6)`: grey values 0-63 become black, 64-127 dark grey, 128-191 light grey, 192-255 white. A 2-bit greyscale PNG is used as is. The table `{0x00, 0x55, 0xaa, 0xff}` is the firmware's own 2-bit to 8-bit mapping. [SRC] `trmnl-firmware` `src/color_reduce.cpp` lines 15-90 and `src/png_render.cpp` lines 278-293 at `d5b610b`
- Consequence: the hex values in our palette only pick a bucket. Changing `#555` to another value in 64-127 changes nothing on the panel; the fix has to be in which pixels get which level. Keep `#000/#555/#AAA/#FFF`, which the on-device test already showed passes through TRMNL unchanged. [INFER]

### Published or recommended palette values

| Source | 2-bit grey values | Evidence |
| --- | --- | --- |
| TRMNL Palettes API | `gray-4`: `"grays": 4`, no hex values (colour palettes list hex, grey ones do not) | [DOC] <https://trmnl.com/api/palettes> |
| TRMNL framework tokens | `gray-30` = `#555555`, `gray-55` = `#AAAAAA` (the two exact greys on 2-bit) | [SRC] `usetrmnl/trmnl-framework` `app/assets/stylesheets/framework/config/_tokens.scss` lines 62-77 at `07a0b39` |
| TRMNL Home Assistant add-on | Even spacing via ImageMagick `-colors 4`; no panel model, no measured values | [SRC] `usetrmnl/trmnl-home-assistant` `trmnl-ha/ha-trmnl/lib/dithering.ts` and `lib/dithering/floyd-steinberg-strategy.ts` at `6451b0c` |
| `epaper-dithering` (OpenDisplay) | `ideal_grayscale4.json`: `#000 #555 #aaa #fff`, flagged `"measured": false`, "Use them only when no measurement exists" | [SRC] `OpenDisplay/epaper-dithering` `examples/palettes/ideal_grayscale4.json` and `examples/palettes/README.md` at `998989b` |
| KOReader | 16 evenly spaced levels (`* 17`) | [SRC] `koreader/koreader-base` `blitbuffer.c` lines 1335-1370 at `94550aa` |

No measured reflectance or L* for a four-grey 7.5" panel was found anywhere. [UNVERIFIED]

One community data point in the same direction: esp32-photoframe's calibration for 16-grey panels models the panel with a "Mid-tone gamma" defaulting to 1.42, described as "1.0 = neutral, >1 darkens mid-tones", plus measured black and white luminance (white defaults to 0.65). That is a different panel class, but it is a maintained project that found e-paper mid-greys darker than their code values and corrects for it. [SRC] `aitjcize/esp32-photoframe` `webapp/src/components/GrayscaleCalibration.vue` at `d4fab28`

### What the phone measurement implies

Treating the measured swatch values as sRGB-encoded and converting (my arithmetic): [RAN] for the arithmetic, [INFER] for the interpretation

| Level | Assumed value | Assumed L* | Measured value | Measured L* |
| --- | --- | --- | --- | --- |
| Black | 0 | 0 | 0 | 0 |
| Dark grey | 85 | 36 | 32 | 12 |
| Light grey | 170 | 70 | 107 | 45 |
| White | 255 | 100 | 255 | 100 |

- Dark grey sits 12 L* above black and light grey 55 L* below white. Perceptually the panel behaves like three levels (near-black, mid grey, white) rather than four even ones. If the 10:1 contrast ratio from the spec sheet is applied instead of stretching black to zero, black and dark grey are about 2 L* apart (38 and 40), which matches "near-solid black" on the device. [INFER]
- Simulating flat tones dithered with the current evenly spaced levels and then shown at the measured levels: input 60 displays as about 26, 85 as 32, 128 as 81, 170 as 107. Everything a dark poster contains lands between black and dark grey, which the panel barely separates. A mid-tone cover survives because most of it sits above 128. [RAN] (simulation only)
- The measurement is rough (phone tone curve, glare, auto-exposure). It should be repeated before it is trusted: RAW or locked exposure, two lights at 45 degrees, a sheet of white paper in frame as reference, average several samples per patch. [DOC] `epaper-dithering` calibration guide, `packages/python/docs/CALIBRATION.md` at `998989b`; TRMNL's own advice is to photograph "under good lighting with locked exposure" [DOC] washed-out article above.

## 2. Dither against measured levels, and in which space

### Measured levels

- Projects that have measurements dither against them and send the nominal values to the panel:
  - esp32-photoframe: the theoretical palette "assumes pure white (255, 255, 255)", so the error computed during dithering is wrong; with measured values "the algorithm makes decisions based on what will actually be displayed". Output files still carry the theoretical colours. [DOC] <https://raw.githubusercontent.com/aitjcize/esp32-photoframe/main/docs/MEASURED_PALETTE.md>
  - epdoptimize: each palette entry has `color` (calibrated appearance, used for dithering) and `deviceColor` (what is sent to the panel). [DOC] <https://cdn.jsdelivr.net/npm/epdoptimize@1.3.0/README.md>
  - epaper-dithering: palette entries have a measured `appearance` and a `nominal`; "Using measured values produces much better dithering results". [SRC] files cited above
  - Pimoroni Inky: `set_image` quantises against a blend of an ideal palette and a `SATURATED_PALETTE` of realistic panel colours (black is `[57, 48, 57]`), default blend 0.5. [SRC] `pimoroni/inky` `inky/inky_uc8159.py` lines 25-50, 190-200, 398 at `a426485`
- All of these are colour panels. No project was found doing it for a 2-bit grey panel, but the reasoning does not depend on colour. [INFER]
- **Recommendation: yes, dither against the panel's measured levels and keep writing the nominal palette.** [INFER]

### Working space

- Authoritative guidance is to diffuse in linear light:
  - "all values should be linearized first, rather than operating directly on sRGB values". [DOC] <https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering>
  - sRGB is not linear, so "we need to convert from sRGB to linear RGB space"; doing so gives "(more) accurate results". [DOC] <https://surma.dev/things/ditherpunk/>
  - libcaca study, greyscale chapter: on a screen a 50% black and white pattern looks closer to 0.73 grey than 0.5; the fix is "converting pixel values into intensity values before performing operations on them"; "The exact same algorithms can be used, they just operate on slightly different data". It also notes that a middle grey placed off-centre cannot always be avoided "if the output palette is fixed". [DOC] <https://gitea.zoy.org/cacalabs/web/raw/branch/master/www/study/part5.html>
- What projects actually do is mixed:
  - TRMNL (ImageMagick `-dither FloydSteinberg`, no linearisation step in the command) and KOReader (ordered 8x8 on 8-bit values) work on encoded values. [SRC] files cited above; that ImageMagick diffuses in the image's current encoded space is [INFER]
  - epaper-dithering picks the nearest ink in OKLab but accumulates and diffuses error in sRGB-encoded space ("Working buffer in sRGB float space", "Quantization error in sRGB space"), while its tone controls run in linear RGB. [SRC] `packages/rust/core/src/algorithms.rs` lines 60-105 and `tone_map.rs` at `998989b`
  - esp32-photoframe and epdoptimize do not document the diffusion space. [UNVERIFIED]
- In my simulation with the measured levels, linear-light diffusion reproduced every flat input tone exactly on the modelled panel, and encoded-space diffusion came out 5 to 20 values lighter in the mid-tones. Both are far better than the current evenly spaced levels. [RAN] (simulation only)
- Perceptual lightness (L*) is the right space for deciding how to lift shadows, but the wrong space for diffusing error: the eye averages light from neighbouring dots, and that average is linear. [INFER]
- **Recommendation: diffuse in linear light, with nearest-level selection in the same space.** Keep the space switchable; if dark areas look too sparse or noisy on the device, encoded-space diffusion against the same measured levels is the fallback and errs on the light side. [INFER]

### A limit no pipeline removes

The TRMNL engineer's note that neighbouring pixels in different grey states disturb each other means a dithered mix of two levels may not average to what flat swatches predict. E Ink patent filings describe the same thing as blooming that makes halftone reflectance hard to predict; I saw those only through search summaries, not the filings. [DOC] custom-luts blog for the first sentence; [UNVERIFIED] for the patents. So the levels should be tuned with dithered patches on the device, not only flat swatches.

## 3. Tone preparation for dark images

### A problem in the current chain

sharp documents `gamma(gamma, gammaOut)` as reducing the encoding before resize by `1/gamma` and increasing it after by `gamma`, to improve resize quality; `gammaOut` defaults to the same value. [DOC] <https://sharp.pixelplumbing.com/api-operation/>

Running a 0-255 ramp through sharp 0.35.5: [RAN]

| Chain | 64 becomes | 128 becomes | 192 becomes |
| --- | --- | --- | --- |
| `greyscale().normalise()` | 62 | 127 | 191 |
| `greyscale().normalise().gamma(1.6)` | 62 | 127 | 191 |
| `greyscale().gamma(1.0, 1.6)` | 107 | 165 | 213 |
| `greyscale().normalise().gamma(1.6).sharpen()` | 39 | 85 | 156 |
| `greyscale().gamma(1.6).sharpen()` | 7 | 15 | 23 |
| `greyscale().gamma(1.6).sharpen({ sigma: 1 })` | 62 | 127 | 191 |

- `.gamma(1.6)` alone does not lift shadows at all. With a parameterless `.sharpen()` after it, the result is darker than the input; with the sigma form it is neutral again. The brightening form is `gamma(1.0, 1.6)`.
- I do not know which sharp version or which sharpen form the project uses, and the pipeline code is not on this branch. Push a ramp through the real chain to see whether it applies. [UNVERIFIED for this project]
- sharp also runs operations in its own internal order, not call order, so tone curves are more predictable done as a lookup table on the raw buffer. [INFER from the results above]

### What e-ink projects do before dithering

| Project | Tone preparation | Evidence |
| --- | --- | --- |
| TRMNL Home Assistant add-on | Strip profile, greyscale, `normalize()` on by default "to prevent gray/washed-out output", optional `-level black%,white%` (defaults 0 and 100, off). No gamma, no local contrast. | [SRC] `lib/dithering.ts` `applyGrayscaleDithering` at `6451b0c` |
| esp32-photoframe | S-curve tone map before Floyd-Steinberg. Documented defaults: strength 0.9, shadow boost 0.0, highlight compress 1.7, midpoint 0.5. A greyscale test fixture uses strength 0.6, shadow boost 0.1, highlight compress 1.3, midpoint 0.5, dynamic range compression on. | [DOC] MEASURED_PALETTE.md; [SRC] `process-cli/test/fixtures/device-config-grayscale.json` at `d4fab28` |
| epaper-dithering | `exposure`, `shadows` (lower half raised with power `1 - shadows`, pivot at perceptual mid-grey), `highlights`, `tone` (remap lightness onto the panel's darkest-to-lightest range; "brings out shadow detail at the cost of deep blacks"). All off by default: "nothing re-maps a photo's tonal range unless you ask". Order: exposure, saturation, shadows/highlights, tone, then match and diffuse. | [DOC] <https://pypi.org/project/epaper-dithering/>; [SRC] `packages/rust/core/src/tone_map.rs`, `packages/rust/core/README.md` at `998989b` |
| epdoptimize | Exposure, contrast, S-curve (strength, shadow boost, highlight compression, midpoint), and LAB lightness compression into the display range with optional percentile clipping. No numeric defaults documented. | [DOC] README above |
| InkyPi | User sliders for brightness, contrast, saturation, sharpness, all defaulting to 1.0 (no change). | [SRC] `fatihak/InkyPi` `src/utils/image_utils.py` lines 64-80 at `2099411` |
| KOReader | None; it only dithers. | [SRC] `blitbuffer.c` |

- **Nobody surveyed uses CLAHE or an adaptive, mean-targeting gamma.** The common pattern is a percentile stretch plus a fixed S-curve or shadow-lift knob set by the user. Adaptive gamma and CLAHE below are my proposal, not established practice. [INFER]
- Inkplate and Kindle screensaver tooling were not checked (code search on the Inkplate library returned nothing useful). [UNVERIFIED]

### Proposal

- **Percentile clip.** sharp's `normalise` defaults to the 1st and 99th luminance percentiles. [DOC] sharp API. On a dark poster the lit subject can be under 1% of the frame, so a 99th percentile white point would blow it out; start at `lower: 0.5, upper: 99.5`. [INFER]
- **Adaptive gamma towards a target mean.** After the stretch, take the mean `m` of the encoded image (0-1) and apply `v ^ e` with `e = ln(target) / ln(m)`, clamped. Target 0.45, clamp `e` to 0.5-1.1. A poster with mean 0.15 gets the full 0.5; a mid-tone cover with mean 0.4 gets about 0.87 and is barely touched. The lower clamp stops near-black posters turning into grey noise. [INFER]
- **Local contrast (optional, start off).** `sharp.clahe({ width, height, maxSlope })`, `maxSlope` default 3, 0 disables limiting. [DOC] sharp API. If the gamma lift leaves shadows flat, try `{ width: 96, height: 96, maxSlope: 2 }` after the lift. CLAHE also amplifies film grain and JPEG blocks in shadows, which error diffusion then renders as noise, so keep the slope low. [INFER]
- **Sharpen** with the sigma form (`sharpen({ sigma: 0.8 })`), after the tone curve. [INFER], and see the table above for why not the parameterless form next to `gamma`.
- **No separate black-point lift.** With measured levels and linear diffusion, a tone renders at its intended place between panel black and panel white, so the lift is carried by the gamma step alone. [INFER]

## 4. Which dithering method

| Method | What sources say | Fit for a 320x480 poster on this panel |
| --- | --- | --- |
| Floyd-Steinberg | Default in TRMNL's guide and add-on ("Photographic content"), esp32-photoframe, epdoptimize. Weakness: "The major problem with Floyd-Steinberg is the worm artifacts it creates"; with serpentine parsing "Most of the worm artifacts have disappeared or were highly reduced". [DOC] libcaca study part 3, <https://gitea.zoy.org/cacalabs/web/raw/branch/master/www/study/part3.html>; [SRC] projects above | Smallest kernel that conserves all the error, so it keeps the most fine detail (title text, faces) at this size. **Recommended, with serpentine.** [INFER] |
| Atkinson | "only propagates 75% of the error, leading to a loss of contrast around very dark and very light areas" (libcaca); "contiguous dark or bright sections of an image may become washed out" (Helland, <https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html>). [DOC] | Dropping error in dark regions is the failure being fixed. Not for posters. Its cleaner look is an argument only for thumbnails (section 5). [INFER] |
| Jarvis-Judice-Ninke, Stucki, Sierra, Burkes | Error spread over more pixels, "leading to much smoother - and more subtle - output" (Helland); patterns "even less likely to emerge" (Surma). Burkes is epaper-dithering's default. [DOC] | Smoother flat areas, softer small detail. Worth one A/B against Floyd-Steinberg if dark areas show worms on the device; Burkes or Sierra first. [INFER] |
| Ordered (Bayer) | "very structured and will look quite repetitive, especially at lower levels" (Surma). KOReader uses ordered 8x8 to 16 levels; it is position-independent and cheap. [DOC], [SRC] | With four uneven levels the threshold must be scaled per interval. Visible cross-hatch at 128 PPI. Position stability has no value for a static poster. No. [INFER] |
| Blue noise | "a nice, even distribution without showing any obvious patterns" (Surma). [DOC] | Good texture, but like any threshold mask it does not conserve error the way diffusion does, and it needs a mask asset. Second choice if error diffusion looks wormy in large dark areas. [INFER] |

E-ink-specific points:

- An image containing grey always gets a full refresh, and fast refresh is 1-bit only. [DOC] (earlier note, fast refresh article). So dither noise does not accumulate as ghosting between frames on a 2-bit poster. [INFER]
- Neighbour disturbance at boundaries between grey shades (custom-luts blog) argues for fewer isolated mid-grey pixels in a different-grey field. With measured levels this largely takes care of itself: dark grey is only chosen in deep shadow and the bulk of a lifted image is a light grey and white mix. If black and dark-grey mixes still look muddy, try removing dark grey from the level list (three-level dither). [INFER]
- Clamp the working value to 0-1 before quantising so diffused error cannot run away in long dark runs. [INFER]; epaper-dithering clamps the same way [SRC] `algorithms.rs` lines 89-91

## 5. Thumbnails (64x96)

No source addresses images this small on e-ink; everything here is inference to check on the device. [INFER]

- Generate each thumbnail from the source image with its own resize, stretch and adaptive gamma. Never downscale the dithered poster.
- Use the same measured levels and linear-light diffusion; the tone error from wrong levels is independent of size.
- At 6,144 pixels, diffusion noise competes with the picture. Pass on only part of the error (`diffusion: 0.75`, which is Atkinson's fraction) to trade some shadow accuracy for a cleaner image, and compare against plain nearest-level quantisation with no diffusion.
- Aim a little lighter (target mean 0.5) and sharpen with a smaller sigma (0.6); skip CLAHE, whose tiles would be most of the image.
- Subjects only read at this size if they are large in frame; a centre-weighted crop may matter more than any dither setting.

## 6. Recommended pipeline

Ordered steps with starting values. The code below ran end to end on a synthetic dark test image and produced a 2-bit PNG containing only 0/85/170/255 (about 18 KB at 320x480, under 1 KB at 64x96). [RAN] How it looks on the panel is untested.

1. **Resize** to exact pixels, cover crop, Lanczos3.
2. **Greyscale**, then **normalise** with `lower: 0.5, upper: 99.5`.
3. **Adaptive gamma** as a 256-entry lookup table: target mean 0.45, exponent clamped to 0.5-1.1. Do not use `sharp.gamma()` for this.
4. **Optional CLAHE** `{ width: 96, height: 96, maxSlope: 2 }` (start off).
5. **Sharpen** `sharpen({ sigma: 0.8 })`.
6. **Dither**: serpentine Floyd-Steinberg, full error, in linear light, against panel levels `[0, 32, 107, 255]` (sRGB-encoded as measured).
7. **Encode**: map level index to `0/85/170/255`, write a 4-colour palette PNG, display 1:1 as now.

```ts
import sharp from "sharp";

interface PosterOptions {
  width: number;
  height: number;
  /** Panel grey levels as sRGB-encoded 0-255, black to white (measured, to tune). */
  panelLevels: [number, number, number, number];
  /** Target mean of the tone-mapped image, sRGB-encoded 0-1. */
  targetMean: number;
  /** Clamp for the adaptive exponent (below 1 brightens). */
  minExponent: number;
  maxExponent: number;
  clipLow: number;
  clipHigh: number;
  clahe: { width: number; height: number; maxSlope: number } | null;
  sharpenSigma: number;
  /** Fraction of the quantisation error passed on (1 = Floyd-Steinberg). */
  diffusion: number;
}

const OUTPUT_LEVELS = [0, 85, 170, 255] as const; // what the PNG carries: #000 #555 #aaa #fff

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

async function preparePoster(input: Buffer, o: PosterOptions): Promise<Buffer> {
  // Pass 1: geometry + greyscale + percentile stretch. No .gamma() here.
  const base = await sharp(input)
    .resize(o.width, o.height, { fit: "cover", kernel: "lanczos3" })
    .greyscale()
    .normalise({ lower: o.clipLow, upper: o.clipHigh })
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  // Adaptive gamma as a 256-entry LUT: pull the mean towards targetMean.
  let sum = 0;
  for (const v of base) sum += v;
  const mean = Math.max(1 / 255, sum / base.length / 255);
  const exponent = Math.min(o.maxExponent, Math.max(o.minExponent, Math.log(o.targetMean) / Math.log(mean)));
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * (i / 255) ** exponent);
  const toned = Buffer.from(base.map((v) => lut[v]));

  // Pass 2: optional local contrast, then sharpen (sigma form only).
  let stage = sharp(toned, { raw: { width: o.width, height: o.height, channels: 1 } });
  if (o.clahe) stage = stage.clahe(o.clahe);
  const grey = await stage.sharpen({ sigma: o.sharpenSigma }).toColourspace("b-w").raw().toBuffer();

  // Serpentine Floyd-Steinberg in linear light against the panel's levels.
  const { width: w, height: h } = o;
  const levels = o.panelLevels.map(srgbToLinear);
  const work = new Float32Array(w * h);
  for (let i = 0; i < work.length; i++) work[i] = srgbToLinear(grey[i]);
  const out = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const dir = y % 2 === 0 ? 1 : -1;
    for (let n = 0; n < w; n++) {
      const x = dir === 1 ? n : w - 1 - n;
      const i = y * w + x;
      const v = Math.min(1, Math.max(0, work[i]));
      let best = 0;
      for (let j = 1; j < 4; j++) if (Math.abs(v - levels[j]) < Math.abs(v - levels[best])) best = j;
      out[i] = OUTPUT_LEVELS[best];
      const err = (v - levels[best]) * o.diffusion;
      const ahead = x + dir;
      const behind = x - dir;
      if (ahead >= 0 && ahead < w) work[i + dir] += (err * 7) / 16;
      if (y + 1 < h) {
        if (behind >= 0 && behind < w) work[i + w - dir] += (err * 3) / 16;
        work[i + w] += (err * 5) / 16;
        if (ahead >= 0 && ahead < w) work[i + w + dir] += (err * 1) / 16;
      }
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 1 } })
    .png({ palette: true, colours: 4, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer();
}

const POSTER: PosterOptions = {
  width: 320,
  height: 480,
  panelLevels: [0, 32, 107, 255],
  targetMean: 0.45,
  minExponent: 0.5,
  maxExponent: 1.1,
  clipLow: 0.5,
  clipHigh: 99.5,
  clahe: null,
  sharpenSigma: 0.8,
  diffusion: 1,
};

const THUMBNAIL: PosterOptions = {
  ...POSTER,
  width: 64,
  height: 96,
  targetMean: 0.5,
  sharpenSigma: 0.6,
  diffusion: 0.75,
};
```

Notes on the code:

- `.toColourspace("b-w")` matters: without it sharp returned three channels from a one-channel raw input after `normalise`, `clahe` or `sharpen`. [RAN]
- `png({ palette: true, colours: 4, dither: 0 })` on a buffer that already holds only four values produced a 2-bit PNG with exactly 0/85/170/255. [RAN]

### Parameters to tune on the device

In rough order of effect:

1. **`panelLevels[1]` and `panelLevels[2]`** (dark and light grey; start 32 and 107, plausible ranges 25-60 and 95-140). Raising them makes the output darker, lowering them lighter. Re-measure first, and judge with dithered 50/50 patches of adjacent levels next to flat swatches, at the real refresh interval.
2. **`targetMean`** (0.40-0.55) and **`minExponent`** (0.4-0.7): how hard dark posters are lifted.
3. **Diffusion space**: linear (default) or encoded, if shadows look too sparse.
4. **Dropping dark grey** (three levels) if black and dark-grey mixes look muddy.
5. **`clahe`** off, or `maxSlope` 2-3 with windows of 64-128 px.
6. **`clipLow` / `clipHigh`** (0.5/99.5, up to 2/98 for flat scans).
7. **`sharpenSigma`** (0.5-1.2).
8. **Kernel**: Floyd-Steinberg, then Burkes or Sierra if worms show in flat dark areas.
9. **Thumbnail `diffusion`** (0, 0.75, 1) and `targetMean`.

Re-check after any change to the device's temperature profile, firmware, or refresh interval, since each can move the greys (section 1).

## What could not be verified

- The panel's real grey reflectances. The only numbers are the rough phone measurement in the brief; no vendor, TRMNL or community figure exists for a four-grey 7.5" panel.
- Which waveform table this device uses (default, profile A or profile B), and whether the hosted TRMNL service changes it over time. The tables were read at firmware 1.8.18's pinned library commit, but I did not trace which table a 30-minute refresh selects, nor the fast variant `epd75_old_gray_init_fast`.
- How the panel averages dithered mixes of adjacent greys (neighbour disturbance). First-party text says the effect exists; its size is unknown. The E Ink patent material was seen only as search summaries.
- Whether the gamma and sharpen interaction applies to this project: it depends on the installed sharp version and on which `sharpen` form the current code calls. Reproduced only on sharp 0.35.5.
- The adaptive gamma target, the clamp, CLAHE settings and all thumbnail advice are inference with starting values, not practice documented by any surveyed project.
- That ImageMagick's Floyd-Steinberg diffuses in encoded space, and the diffusion space of esp32-photoframe and epdoptimize.
- Inkplate and Kindle screensaver tooling were not examined. A Raspberry Pi frame project surfaced in search (saturation, contrast and gamma 0.9 defaults, Atkinson) but was not read at source and is not relied on.
- Nothing was run on the device. Every "looks" claim is a prediction.

## Sources

TRMNL
- Palettes API: <https://trmnl.com/api/palettes>; Models API: <https://trmnl.com/api/models>
- OG spec sheet: <https://trmnl.com/products/og/spec-sheet>
- Blog, Bending ePaper To Our Will with Custom LUTs: <https://trmnl.com/blog/custom-luts>
- Blog, No more flicker: <https://trmnl.com/blog/no-more-flicker>
- Tuning a washed-out display: <https://help.trmnl.com/en/articles/12566040-tuning-a-washed-out-display>
- `usetrmnl/trmnl-firmware` at `d5b610b` (main) and tag `v1.8.18` (`4ffa33a`): `src/board_config.cpp`, `src/png_render.cpp`, `src/color_reduce.cpp`, `src/display.cpp`, `platformio.ini`
- `usetrmnl/trmnl-home-assistant` at `6451b0c`: `trmnl-ha/ha-trmnl/lib/dithering.ts`, `lib/dithering/floyd-steinberg-strategy.ts`
- `usetrmnl/trmnl-framework` at `07a0b39`: `app/assets/stylesheets/framework/config/_tokens.scss`
- "How to enable 2-bit on TRMNL OG" (<https://help.trmnl.com/en/articles/12512706-how-to-enable-2-bit-on-trmnl-og>) still returns HTTP 404.

Panel and driver
- `bitbank2/bb_epaper` at `8e26f00` and `1a38d70`: `src/bb_epaper.h`, `src/bb_ep.inl`
- Good Display GDEY075T7: <https://www.good-display.com/product/396.html>

Dithering references
- Wikipedia, Floyd-Steinberg dithering: <https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering>
- Surma, Ditherpunk: <https://surma.dev/things/ditherpunk/>
- libcaca study, parts 3 and 5: <https://gitea.zoy.org/cacalabs/web/raw/branch/master/www/study/part3.html>, <https://gitea.zoy.org/cacalabs/web/raw/branch/master/www/study/part5.html>
- Tanner Helland, Dithering: eleven algorithms: <https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html>

E-ink projects
- `OpenDisplay/epaper-dithering` at `998989b`; package page <https://pypi.org/project/epaper-dithering/>
- `aitjcize/esp32-photoframe` at `d4fab28`; <https://raw.githubusercontent.com/aitjcize/esp32-photoframe/main/docs/MEASURED_PALETTE.md>
- epdoptimize README: <https://cdn.jsdelivr.net/npm/epdoptimize@1.3.0/README.md>
- `pimoroni/inky` at `a426485`: `inky/inky_uc8159.py`
- `fatihak/InkyPi` at `2099411`: `src/utils/image_utils.py`
- `koreader/koreader-base` at `94550aa`: `blitbuffer.c`

sharp
- Operations API: <https://sharp.pixelplumbing.com/api-operation/>

Note on method: web pages were read through a summarising fetch tool, so quoted phrases are short extracts and should be re-checked against the live page before being relied on verbatim. GitHub source files and the TRMNL APIs were read directly. Local runs used a scratch install of sharp 0.35.5 and synthetic images only.
