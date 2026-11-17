# Research: getting a poster or cover onto the TRMNL's 2-bit screen

Researched 2026-11-17 for the "Spotlight" card redesign. Throwaway research branch, not for merge.

**Question.** How does a poster or cover image end up on the TRMNL's 2-bit screen, and what gives the best result?

**Evidence labels** used on every claim:

- **[DOC]** stated in TRMNL / Next.js / Vercel / sharp official documentation (fetched 2026-11-17).
- **[FETCH]** verified by fetching a live first-party endpoint or first-party source code.
- **[REPO]** inferred from this repository.
- **[INFER]** my reasoning from the facts above; not stated by any source.
- **[UNCONFIRMED]** could not be established from any primary source.

## Short answer

1. This repo is almost certainly connected through TRMNL's hosted **Screenshot plugin**: TRMNL's servers load the Vercel page in their own browser, screenshot it at 800x480, convert it to the device's palette, and the device downloads the resulting PNG.
2. TRMNL does the colour reduction and dithering **server-side**. It does not need pre-dithered input. But the exact conversion applied to Screenshot-plugin output (algorithm, whether it dithers at all, gamma) is **not documented**. TRMNL's own open-source pipelines all use ImageMagick Floyd-Steinberg plus `-posterize 4` for 2-bit.
3. Best result: **pre-process the poster ourselves** (resize to exact display pixels, grayscale, contrast stretch, Floyd-Steinberg to exactly `#000 / #555 / #AAA / #FFF`), serve it as a PNG from our own absolute URL, and display it 1:1 with no CSS scaling. A four-level image should pass through any sane 4-level quantiser unchanged, so we control the look regardless of what TRMNL does. This last step is inference and needs one on-device test.
4. Do not use `next/image` for the poster: it emits relative `/_next/image?...` URLs, lazy-loads by default, and re-encodes to WebP, all of which work against the Screenshot plugin.

## 1. Which integration this repo uses

| Claim | Evidence |
| --- | --- |
| The page is an ordinary server-rendered Next.js route at `/` sized to 800x480; there is no image-generating endpoint. | [REPO] `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/layout.tsx`, `.trmnl-container` in `src/app/globals.css` |
| The README architecture diagram says "TRMNL Device (Screenshots webpage)". | [REPO] `README.md` |
| The deployment guide tells the user to create a plugin with a URL of the Vercel app and "Preview the screenshot". | [REPO] `docs/09-deployment.md` sections 9.9 to 9.11, `docs/06-dashboard-renderer.md` "TRMNL Screenshot Testing" |
| The repo's stated constraints (800x480, 5 second render, absolute URLs) match the Screenshot plugin help article word for word. | [REPO] `CLAUDE.md`; [DOC] [Screenshot help article](https://help.trmnl.com/en/articles/10302121-screenshot) |
| No BYOS endpoints (`/api/display`, `/api/setup`), no Liquid markup, no webhook push to TRMNL, no TRMNL framework CSS/JS loaded by the app. | [REPO] grep of `src/`, `.github/`; `plugins.css` appears only in `docs/06-dashboard-renderer.md`, never in code |

**Conclusion: Screenshot plugin. Confidence: medium-high (about 85%).**

Why not higher: `docs/09-deployment.md` describes the setup as "Private Plugin ... Type: Webpage ... Refresh Strategy: Webhook". That combination does not correspond to any TRMNL plugin I could find documented, and reads like an inaccurate planning doc rather than a record of what was configured. The real plugin configuration lives in the TRMNL account and cannot be read from the repo. **Action: confirm in the TRMNL dashboard that the instance is under Plugins > Screenshot.**

Ruled out by the repo: BYOS (no device API), Private Plugin markup (no Liquid, no framework classes), Alias / Redirect / Image Display (those need an image URL, the repo serves HTML only).

## 2. The pipeline from page to panel

### What is documented for the Screenshot plugin

All from the [Screenshot help article](https://help.trmnl.com/en/articles/10302121-screenshot), last updated 2026-10-07. [DOC]

- "TRMNL does not visit this website directly and take a screenshot." It copies the page's HTML into a new browser and screenshots that. The HTML "will include references to CSS and JavaScript".
- TRMNL attempts to convert relative CSS and JavaScript URLs to absolute ones; "This is not a perfect solution however."
- Image `src` attributes "need to contain absolute paths". No rewriting is promised for images.
- "TRMNL has a 5 second timeout for screenshots." Content that has not loaded may appear blank.
- "The TRMNL display resolution is 800x480."
- "Our screenshot generation service is in Germany." Sites that block EU traffic can fail.
- Optional request headers can be sent (`key=value` pairs joined with `&`).
- The article says **nothing** about bit depth, dithering, colour conversion, image size or image count.

Refresh behaviour, from [How refresh rates work](https://help.trmnl.com/en/articles/10113695-how-refresh-rates-work): [DOC]

- Devices poll the server; the device refresh minimum is 5 minutes.
- Plugins refresh at most every 15 minutes by default (5 with TRMNL+).
- A new screen is only rendered when plugin data changed, except "Clock, and Screenshot with **Always refresh?** set to yes ... render every time."
- How change is detected for Screenshot when "Always refresh?" is off is not documented. [UNCONFIRMED]

### What is documented about palette and bit depth

- TRMNL OG has two model profiles: `og_png` "TRMNL OG (1-bit)", 800x480, palette `bw`; and `og_plus` "TRMNL OG (2-bit)", 800x480, 4 colours, palettes `bw` and `gray-4`. TRMNL X (`v2`) is 1872x1404, 4-bit, palettes `gray-16`, `gray-4`, `bw`. [FETCH] <https://trmnl.com/api/models>
- Palette ids: `bw` (2 grays, `screen--1bit`), `gray-4` (4 grays, `screen--2bit`), `gray-16` (`screen--4bit`). The API does not publish hex values for the gray levels. [FETCH] <https://trmnl.com/api/palettes>
- 2-bit needs firmware 1.6.0 or later. [DOC] [ImageMagick guide](https://docs.trmnl.com/go/imagemagick-guide)
- The palette is a **user setting**: device settings > "Color Palette", overridable per playlist item (Playlist > three dots > "Presentation"). Changes apply the next time the plugin refreshes. Larger palettes make "photos and screenshots look closer to their originals" at the cost of larger files, slower transitions and battery. [DOC] [Understanding color palettes](https://help.trmnl.com/en/articles/12985974-understanding-color-palettes) (updated 2026-10-08)
- Fast refresh only works with 1-bit images; 2-bit images bring back a flash, and "Images containing gray always get a full refresh". The firmware option "Enable Maximum Compatibility" forces 1-bit images. [DOC] [What is fast refresh](https://help.trmnl.com/en/articles/12512481-what-is-fast-refresh), [Tuning a washed-out display](https://help.trmnl.com/en/articles/12566040-tuning-a-washed-out-display)
- Firmware 1.8.18 (2026-10-30) changed refresh tables, and "At a refresh interval of 30 minutes or longer, some panels also draw lighter than before." This project refreshes every 30 minutes. [DOC] same washed-out article
- "the exact shade of gray will vary from device to device" (temperature profiles nudge grays lighter or darker). [DOC] [Grayscale in Framework](https://help.trmnl.com/en/articles/12386214-grayscale-1-bit-2-bit-4-bit-in-framework)

So the repo's assumption of a 4-gray panel is only true if the device is on firmware 1.6+, its Color Palette is the 4-gray one, and Maximum Compatibility is off. None of that is visible from the repo. [UNCONFIRMED for this device]

### How the screenshot becomes a 2-bit PNG

Not documented for TRMNL's hosted service. [UNCONFIRMED] What can be established:

- The framework docs say dithering is "a platform behavior: TRMNL applies it when it renders the screen", and for `gray-16` "the platform posterizes and dithers to those 16 levels before it sends the screen." [DOC] [Image](https://trmnl.com/framework/docs/3.4/image), [Color palettes](https://trmnl.com/framework/docs/3.4/color_palettes)
- The framework source confirms "devices are dithered server-side". [FETCH] [`trmnl-framework/app/javascript/plugin-render/dithering.js`](https://github.com/usetrmnl/trmnl-framework/blob/main/app/javascript/plugin-render/dithering.js)
- TRMNL's official recipe for a 2-bit PNG is: [DOC] [ImageMagick guide](https://docs.trmnl.com/go/imagemagick-guide)

  ```
  magick input.png -colorspace Gray -dither FloydSteinberg -posterize 4 -alpha off -depth 2 -define png:compression-level=9 -strip png:output.png
  ```

  with a `-dither None` variant for undithered output.
- TRMNL's flagship open-source BYOS server (Terminus) does exactly this: for bit depth 2 to 4 in "dither" mode it runs `colorspace Gray`, `dither FloydSteinberg`, `posterize <grays>`; in the default "text" mode it runs the same with `dither None`. [FETCH] [`terminus/app/aspects/screens/converters/monochrome.rb`](https://github.com/usetrmnl/terminus/blob/4a38f233603714a093a1d57784ad0c14fa250de4/app/aspects/screens/converters/monochrome.rb)
- The hosted service probably behaves like one of those two modes, but which one the Screenshot plugin uses (dithered, or plain posterize that would band a photo into four flat tones) is not stated anywhere. [INFER / UNCONFIRMED]

### Device-side limit

- "90,000 bytes for ESP32 boards without PSRAM like TRMNL OG"; the firmware will not draw a larger PNG. TRMNL X allows 750,000 bytes. [DOC] [ImageMagick guide](https://docs.trmnl.com/go/imagemagick-guide)
- An 800x480 2-bit bitmap is 96,000 bytes before compression, and error-diffusion noise compresses badly. A full-bleed dithered photo could approach the limit; a poster covering roughly a third of the screen, next to flat text areas, should not. [INFER]
- How the hosted service behaves when its own output would exceed the limit is not documented. [UNCONFIRMED]

## 3. Does TRMNL dither, and what does its design guidance say about artwork?

- TRMNL dithers for you; it does not expect pre-dithered input. Image Display "accepts images in any format or size" and reformats them; the Alias plugin is the one that requires images already at exact TRMNL specifications. [DOC] [Image Display](https://help.trmnl.com/en/articles/11479051-image-display)
- For sharp results TRMNL says to supply images "at or above the slot's native pixel dimensions"; smaller images look blurry. [DOC] same article
- Framework utility: add `image-dither` to a raster `<img>` and it is "dithered to the screen's palette" by the platform. A pre-dithered image takes no class and is "served as-is". The docs explicitly support both paths: [DOC] [Image, framework 3.4](https://trmnl.com/framework/docs/3.4/image)

  ```html
  <img class="image image-dither rounded" src="path to the image file">
  <img class="image rounded" src="path to the dithered image file">
  ```

- The framework's own demo ships a separately prepared source per bit depth (`image--1bit.png`, `image--2bit.png`, `image--4bit.png`), which is TRMNL itself choosing pre-prepared art per palette. [DOC] same page
- Other image utilities: `image--contain`, `image--cover`, `image--fill`, `image--small`, `image--xsmall`, `invert`, `image-stroke`, `image--adaptive` (silhouette icons only, "not photos"). [DOC] same page
- Exact, non-dithered framework grays on 2-bit are black, white, `gray-30` ("darker gray") and `gray-55` ("lighter gray"); every other shade is dithered. On 1-bit, dithering approximates 14 grays. The article links Floyd-Steinberg as the dithering reference. [DOC] [Grayscale in Framework](https://help.trmnl.com/en/articles/12386214-grayscale-1-bit-2-bit-4-bit-in-framework)
- **Relevance to this repo:** these classes are part of TRMNL's framework for plugin markup. This app does not load the framework, and whether `image-dither` has any effect inside a Screenshot-plugin capture is undocumented. Assume it does not. [REPO] + [UNCONFIRMED]
- This repo's e-ink colours are `#000000`, `#555555`, `#aaaaaa`, `#ffffff`, which are exactly the four levels `-posterize 4` produces (0, 85, 170, 255). [REPO] `src/app/globals.css`; [INFER] arithmetic

## 4. Recommendation: dither server-side ourselves

### Why this beats letting TRMNL convert

- TRMNL's conversion of Screenshot output is undocumented and applied to the whole frame. If it dithers, it also dithers our anti-aliased text edges; if it only posterizes, a poster becomes four flat bands. We cannot tune either. [INFER]
- A browser downscale of a 1000x1500 poster to roughly 290x435 CSS pixels happens before TRMNL's quantiser, so we have no say over resampling or sharpening either. [INFER]
- An image whose every pixel is already one of the four target levels has zero quantisation error, so Floyd-Steinberg plus `posterize 4`, or plain `posterize 4`, leaves it untouched. Pre-dithering is therefore safe under either TRMNL behaviour. [INFER, needs one device test]
- TRMNL's own docs treat pre-dithered images as a first-class path. [DOC] (section 3)

The condition for all of this: the pre-dithered pixels must reach the screenshot unscaled. Render the `<img>` at exactly its intrinsic pixel size, set `image-rendering: pixelated`, no `object-fit` scaling, no rounded corners cutting through dither, lossless PNG only. If TRMNL's browser captured at a device scale factor other than 1 this would break; the model API lists `scale_factor: 1.0` for both OG profiles, which suggests it does not. [FETCH] for the scale factor, [INFER] for the consequence.

### Pipeline

Order matters. Steps marked (TRMNL) mirror TRMNL's own Home Assistant add-on, the only first-party code I found that pre-processes for e-ink. [FETCH] [`trmnl-home-assistant/.../lib/dithering.ts`](https://github.com/usetrmnl/trmnl-home-assistant/blob/6451b0c0e43328c5060b2fb2447f1d26c7286aba/trmnl-ha/ha-trmnl/lib/dithering.ts)

1. **Resize to the exact slot size in device pixels** with a good kernel (Lanczos), cover-crop to the card's aspect ratio. Never let the browser or TRMNL scale a dithered image. [INFER]
2. **Strip the colour profile, convert to grayscale.** (TRMNL: `noProfile()`, `colorspace('Gray')`.) [FETCH]
3. **Normalise (auto-contrast stretch).** TRMNL's add-on turns this on by default for every palette "to prevent gray/washed-out output". [FETCH]
4. **Levels.** The add-on exposes black and white points as percentages via `-level`. [FETCH] For posters, clip a few percent at each end so near-blacks go solid black and near-whites go clean white; dark movie posters usually also need a gamma lift so mid-tones do not collapse into the two dark levels. Specific values are a judgement call to tune on the device. [INFER]
5. **Mild sharpen** after the resize; error diffusion softens edges and small title text on covers. [INFER]
6. **Floyd-Steinberg error diffusion to four levels.** TRMNL's add-on calls it best for "Photographic content (gradients, faces, natural scenes)" and offers ordered and threshold as alternatives. [FETCH] [`floyd-steinberg-strategy.ts`](https://github.com/usetrmnl/trmnl-home-assistant/blob/6451b0c0e43328c5060b2fb2447f1d26c7286aba/trmnl-ha/ha-trmnl/lib/dithering/floyd-steinberg-strategy.ts)
7. **Encode as lossless grayscale PNG**, maximum compression.

Because the panel may now draw lighter at 30-minute intervals (section 2) and grays vary per device, expect to bias the image slightly darker and more contrasty than looks right on a monitor. [INFER from DOC]

### Doing it with sharp

- sharp can do steps 1 to 5 natively (`resize`, `grayscale`, `normalise`, `linear` / `gamma`, `sharpen`). [DOC] <https://sharp.pixelplumbing.com/>
- sharp's only dithering is in `png({ palette: true, colours, dither })`: "level of Floyd-Steinberg error diffusion", with `colours` the "maximum number of palette entries". It quantises to an **adaptive** palette; the docs describe no fixed-palette remap and no ordered dithering. So `colours: 4` gives four grays chosen from the image, not our `#000/#555/#AAA/#FFF`. [DOC] <https://sharp.pixelplumbing.com/api-output/>
- Therefore: use sharp up to a raw 8-bit grayscale buffer (`.raw()`), run a hand-written Floyd-Steinberg loop over the buffer snapping to 0 / 85 / 170 / 255, then hand the buffer back to sharp to encode a PNG. A poster-sized image is about 125,000 pixels, so this is trivial work. [INFER]
- sharp is not currently a dependency of this repo; `package.json` has neither `sharp` nor any image code, and there are no `<img>` tags in `src/`. [REPO]
- Not verified by running code: ImageMagick is not installed on this machine and I did not install sharp. The "passes through TRMNL unchanged" claim should be the first thing a prototype checks, by comparing the TRMNL preview PNG against our PNG pixel for pixel. [UNCONFIRMED]

### Where to run it

Fits the existing cache-first design: dither during the `/api/refresh` job, not during page render, so the 5-second budget is never spent on image work. [REPO] + [INFER]

- Option A: the refresh job fetches the poster, dithers it, stores the PNG (a few tens of KB as base64 in Upstash, or in a blob store) and the page references `https://<host>/api/spotlight/image?v=<hash>`, served with long cache headers.
- Option B: inline the PNG as a `data:` URI in the server-rendered HTML. The Screenshot plugin copies our HTML into its own browser, so an inlined image needs no second request, cannot be blocked, and cannot miss the timeout. Cost is a larger HTML payload. Whether TRMNL's HTML copy step has a size cap is not documented. [INFER / UNCONFIRMED]

Option B is the more robust against the documented failure modes; Option A is easier to debug. Either is fine.

## 5. Limits: size, count, load time, URLs, Next.js image optimisation

| Topic | Finding | Evidence |
| --- | --- | --- |
| Render budget | 5 seconds for the whole screenshot, including every image. Late images come out blank. | [DOC] Screenshot article |
| Image count / size on the page | No documented limit. The only bound is the 5-second timeout. | [DOC] absence in Screenshot article; [UNCONFIRMED] beyond that |
| Final device image | 90,000 bytes PNG on TRMNL OG. | [DOC] ImageMagick guide |
| Absolute URLs | Required for images. CSS/JS relative URLs get a best-effort rewrite; images get no such promise. | [DOC] Screenshot article |
| Fetch origin | TRMNL's renderer is in Germany and fetches images from there, not from the device or from Vercel's Sydney edge. Third-party poster CDNs that hotlink-protect, rate-limit or geo-block will fail silently. TRMNL notes imgur is unreliable for this reason. | [DOC] Screenshot and Image Display articles; [INFER] for poster CDNs |
| `next/image` URL shape | Emits `src="/_next/image?url=...&w=...&q=75"` plus a `srcset`, both **relative**. That violates the absolute-path requirement. | [DOC] [next/image reference](https://nextjs.org/docs/app/api-reference/components/image) (updated 2026-11-06) |
| `next/image` loading | Defaults to `loading="lazy"`. A headless capture may never trigger it. | [DOC] same; [INFER] for the capture |
| `next/image` config | Remote hosts must be allow-listed in `remotePatterns`; `qualities` is a required allow-list from Next.js 16. This repo's `next.config.ts` has no `images` block. | [DOC] same; [REPO] `next.config.ts` |
| `next/image` output | Re-encodes (WebP by default) and resizes. Either would destroy a pre-dithered image. | [DOC] same; [INFER] |
| Vercel Hobby image optimisation | 5K transformations, 300K cache reads, 100K cache writes per month; over the limit new images return HTTP 402. Source images max 8192 px per side. | [DOC] [Vercel limits and pricing](https://vercel.com/docs/image-optimization/limits-and-pricing) (updated 2026-11-12) |

**Verdict on `next/image`:** do not use it for the Spotlight image. Use a plain `<img>` with an absolute `https://` URL built from `NEXT_PUBLIC_APP_URL` (or a `data:` URI), `loading="eager"`, explicit `width`/`height` equal to the PNG's pixel size. If `next/image` is wanted for some other reason, `unoptimized` plus an absolute `src` and `loading="eager"` avoids the problems above, at which point it adds nothing. [INFER]

## 6. Open questions to settle with a prototype

1. Confirm the TRMNL plugin instance really is Screenshot, and note its "Always refresh?" setting. With it off, a new poster may not trigger a re-render if TRMNL's change detection does not see the difference.
2. Confirm the device's Color Palette is the 4-gray palette, firmware is 1.6 or later, and Maximum Compatibility is off. Otherwise everything lands on 1-bit and the poster should be dithered to two levels instead.
3. Put one test page up with three copies of the same poster: untouched colour JPEG, our 4-level pre-dithered PNG, and an undithered 4-level posterised PNG. Download TRMNL's generated preview and compare. That single test answers: does TRMNL dither Screenshot output, does our PNG pass through bit-exact, and is the capture at scale factor 1.
4. Check the generated PNG's byte size against the 90,000-byte limit with the largest plausible Spotlight card.
5. Tune black point, white point and gamma on the physical panel, at the real 30-minute interval.

## Sources

TRMNL help centre
- Screenshot: <https://help.trmnl.com/en/articles/10302121-screenshot>
- Image Display: <https://help.trmnl.com/en/articles/11479051-image-display>
- How refresh rates work: <https://help.trmnl.com/en/articles/10113695-how-refresh-rates-work>
- Understanding color palettes: <https://help.trmnl.com/en/articles/12985974-understanding-color-palettes>
- Grayscale: 1-bit, 2-bit, 4-bit in Framework: <https://help.trmnl.com/en/articles/12386214-grayscale-1-bit-2-bit-4-bit-in-framework>
- What is fast refresh: <https://help.trmnl.com/en/articles/12512481-what-is-fast-refresh>
- Tuning a washed-out display: <https://help.trmnl.com/en/articles/12566040-tuning-a-washed-out-display>
- How to enable 2-bit on TRMNL OG (<https://help.trmnl.com/en/articles/12512706-how-to-enable-2-bit-on-trmnl-og>) returned HTTP 404 on fetch; not used.

TRMNL developer docs and APIs
- ImageMagick guide: <https://docs.trmnl.com/go/imagemagick-guide>
- Framework 3.4 Image: <https://trmnl.com/framework/docs/3.4/image>
- Framework 3.4 Color palettes: <https://trmnl.com/framework/docs/3.4/color_palettes>
- Framework 3.4 Devices: <https://trmnl.com/framework/docs/3.4/devices>
- Framework 3.4 Rendering modes: <https://trmnl.com/framework/docs/3.4/rendering_modes>
- Models API: <https://trmnl.com/api/models>
- Palettes API: <https://trmnl.com/api/palettes>
- Blog, Introducing Palettes (2025-12-04): <https://trmnl.com/blog/color-palettes>

TRMNL source (github.com/usetrmnl)
- `terminus` `app/aspects/screens/converters/monochrome.rb` at `4a38f23`
- `trmnl-home-assistant` `trmnl-ha/ha-trmnl/lib/dithering.ts` and `lib/dithering/floyd-steinberg-strategy.ts` at `6451b0c`
- `trmnl-framework` `app/javascript/plugin-render/dithering.js` (main)

Other
- sharp output options: <https://sharp.pixelplumbing.com/api-output/>
- Next.js Image component: <https://nextjs.org/docs/app/api-reference/components/image>
- Vercel image optimisation limits: <https://vercel.com/docs/image-optimization/limits-and-pricing>

Note on method: web pages were read through a summarising fetch tool, so quoted phrases are short extracts and should be re-checked against the live page before being relied on verbatim. GitHub source files were read directly.
