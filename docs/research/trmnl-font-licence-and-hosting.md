# TRMNL font licence and hosting

Researched 2026-11-17. All live tests were run that day from a machine in Sydney (Cloudflare PoP `SYD`).

Each claim is labelled by how it was established:

- **[docs]** read in TRMNL's published documentation
- **[source]** read in the `usetrmnl/trmnl-framework` repository or the served CSS/font files
- **[tested]** measured live with `curl`
- **[inferred]** my reasoning from the above; not stated by a source

## Answer in short

**Use them, and self-host them.** TRMNL12, TRMNL16 and TRMNL21 are published under the SIL Open Font License 1.1. That licence permits use outside TRMNL's framework, loading from anywhere, and committing copies to a public repository, provided the copyright notice and licence text travel with the files. Self-hosting is preferred over `trmnl.com` because the `trmnl.com` font URLs are unversioned and have already been replaced in place, not because they are slow.

The one residual licence risk: the OFL grant is asserted by TRMNL (the commissioner), not by a statement from the copyright holder (Heavyweight Digital Type Foundry) that I could find. See [Residual risk](#residual-risk).

## 1. Licence

### What the fonts are

- Three families, each in Regular and Bold: TRMNL12, TRMNL16, TRMNL21. **[docs]** <https://trmnl.com/framework/docs/3.4/font_family.md>
- Designer: Heavyweight Digital Type Foundry (<https://heavyweight-type.com>), commissioned by TRMNL. Copyright holder: Heavyweight Digital Type Foundry s.r.o. **[docs]** <https://trmnl.com/fonts/bundles/trmnl/README.md>
- Introduced as the default low-density fonts in Framework 3.1; the older "Classic" bundle (NicoPups, NicoClean, BlockKie) remains available. **[source]** `public/framework/releases/3.1.0.md`: "Added TRMNL12, TRMNL16, and TRMNL21 as the default low-density font families for Framework 3.1."

### The licence, stated in four independent places

1. **Framework repository `LICENSE`** **[source]** <https://github.com/usetrmnl/trmnl-framework/blob/main/LICENSE> (read at commit `07a0b39e`):

   > Font files under public/fonts/ are not covered by the MIT license above.
   > They are licensed separately by their respective copyright holders:
   >
   > - TRMNL12, TRMNL16, TRMNL21: Copyright © 2026 Heavyweight Digital Type
   >   Foundry s.r.o. Licensed under the SIL Open Font License, Version 1.1.
   > - Inter Variable: Copyright 2016 The Inter Project Authors
   >   (https://github.com/rsms/inter). Licensed under the SIL Open Font License,
   >   Version 1.1.
   > - NicoPups, NicoClean: Copyright (c) 2021, Emily Huo. Licensed under the
   >   SIL Open Font License, Version 1.1.
   > - BlockKie: Copyright (c) 2021 JoohnFonts. Licensed under Creative Commons
   >   Attribution 3.0 Unported (CC BY 3.0).

2. **Framework docs, Open Source page** **[docs]** <https://trmnl.com/framework/docs/3.4/open_source.md>:

   > The MIT grant covers the code; the bundled fonts are licensed separately. The TRMNL pixel fonts (by Heavyweight Digital Type Foundry), Inter, and the Nico fonts ship under the SIL Open Font License 1.1; BlockKie ships under CC BY 3.0. Each font bundle download carries the full terms in its README and OFL.txt.

3. **The font bundle README and `OFL.txt`** **[docs]** <https://trmnl.com/fonts/bundles/trmnl/README.md>, <https://trmnl.com/fonts/bundles/trmnl/OFL.txt>. Per face: "**License:** SIL Open Font License v1.1" and "**Copyright:** Copyright © 2026 Heavyweight Digital Type Foundry s.r.o." The `OFL.txt` header reads:

   > Copyright © 2026 Heavyweight Digital Type Foundry s.r.o.
   > Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)
   >
   > This Font Software is licensed under the SIL Open Font License, Version 1.1.

   No Reserved Font Name is declared after the copyright statement.

4. **The font files' own metadata** **[source]** read from the `name` table of all six `.ttf` files and of `TRMNL16-Regular.woff` served by `trmnl.com` (fetched to a temporary directory outside the repo):

   | Field | Value |
   | --- | --- |
   | name 0 (copyright) | `Copyright © 2026 Heavyweight Digital Type Foundry s.r.o. All rights reserved.` |
   | name 5 (version) | `Version 1.002; Glyphs 3.5, build 3516.0; TRMNL grid-alignment + OFL licensing metadata fix 2026-07-24` |
   | name 8 / 9 (manufacturer / designer) | `Renegadefonts` / `HeavyWeight` |
   | name 13 (licence) | `This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org` |
   | name 14 (licence URL) | `https://openfontlicense.org` |
   | OS/2 `fsType` | `0` (installable embedding, no restriction) |

   The `.woff2` files were not decoded (no Brotli decoder available); the font changelog says all three formats were regenerated from the same corrected TTFs.

### What the OFL permits

Verbatim from the OFL 1.1 text shipped in the bundle README (<https://trmnl.com/fonts/bundles/trmnl/README.md>):

> Permission is hereby granted, free of charge, to any person obtaining
> a copy of the Font Software, to use, study, copy, merge, embed, modify,
> redistribute, and sell modified and unmodified copies of the Font
> Software, subject to the following conditions:
>
> 1) Neither the Font Software nor any of its individual components,
> in Original or Modified Versions, may be sold by itself.
>
> 2) Original or Modified Versions of the Font Software may be bundled,
> redistributed and/or sold with any software, provided that each copy
> contains the above copyright notice and this license. These can be
> included either as stand-alone text files, human-readable headers or
> in the appropriate machine-readable metadata fields within text or
> binary files as long as those fields can be easily viewed by the user.
>
> 3) No Modified Version of the Font Software may use the Reserved Font
> Name(s) unless explicit written permission is granted by the corresponding
> Copyright Holder. [...]
>
> 5) The Font Software, modified or unmodified, in part or in whole,
> must be distributed entirely under this license, and must not be
> distributed under any other license. The requirement for fonts to
> remain under this license does not apply to any document created
> using the Font Software.

Applied to the three questions **[inferred]** from the licence text:

| Question | Answer | Basis |
| --- | --- | --- |
| (a) May a page outside TRMNL's framework use them? | Yes | "any person obtaining a copy ... to use". Nothing ties the grant to the framework or to TRMNL hardware. |
| (b) May it load them from `trmnl.com`? | The licence does not forbid it and the server allows it (`access-control-allow-origin: *`, tested). No TRMNL document invites or forbids third-party hotlinking; the docs only say the framework's fonts "come from wherever `plugins.css` came from". | Licence text; headers **[tested]**; <https://trmnl.com/framework/docs/3.4/open_source.md> |
| (c) May it host copies, including in a public GitHub repo? | Yes, if the copyright notice and the OFL text accompany the files (condition 2) and the files stay under the OFL (condition 5). | Licence text. TRMNL itself does exactly this in its public MIT repo. |

Practical conditions for committing them to this repo **[inferred]**:

- Commit the bundle's `OFL.txt` next to the font files. The files' embedded metadata arguably satisfies condition 2 on its own, but the text file removes doubt.
- State in the repo's licence or README that the font files are OFL 1.1 and not covered by the repo's own licence (condition 5).
- Use the files unmodified. Subsetting or format conversion makes a "Modified Version"; that is still allowed (no Reserved Font Name is declared) but adds nothing here, since the WOFF2 files are 40 to 52 KB each.

### Not found

- No statement by Heavyweight Digital Type Foundry itself about the licence. A search restricted to `heavyweight-type.com` and `renegadefonts.com` returned nothing about these fonts.
- No TRMNL terms-of-service clause about fonts was looked up; the OFL grant does not depend on one.
- No policy on third-party hotlinking of `trmnl.com/fonts/`.

## 2. Design sizes, smoothing and line height

### Native sizes

**[docs]** <https://trmnl.com/framework/docs/3.4/font_family.md>:

| Face | Designed at | TRMNL's intended use |
| --- | --- | --- |
| TRMNL12 | "Designed at **12px** pixel height" | "descriptions, small labels, and metadata" |
| TRMNL16 | "Designed at **16px** pixel height" | "The workhorse font, used for labels, rich text body copy, and title-bar text" |
| TRMNL21 | "Designed at **21px** pixel height" | "titles, headings, and large rich-text" |

The files agree **[source]**: `unitsPerEm` is 1032 (12 x 86), 1024 (16 x 64) and 1008 (21 x 48), so one font unit grid cell is exactly one pixel at the native size.

Use them only at those sizes. **[docs]** same page: "**Any Scale or Text Scale other than Regular:** Inter Variable, because pixel bundles only render correctly at their native sizes." The Pixel Perfect page (<https://trmnl.com/framework/docs/3.4/pixel_perfect.md>) says pixel fonts "work at particular pixel sizes and their multipliers", so integer multiples (24, 32, 42 px) are the only other candidates **[inferred]**; the framework itself never uses them and switches to Inter for anything larger.

### `@font-face` rules

**[source]** `https://trmnl.com/css/latest/plugins.css` (identical to `app/assets/stylesheets/framework/config/_fonts.scss`). Same shape for all six files:

```css
@font-face{font-family:"TRMNL16";font-style:normal;font-weight:normal;
  src:url("/fonts/TRMNL16-Regular.woff2") format("woff2"),
      url("/fonts/TRMNL16-Regular.woff") format("woff"),
      url("/fonts/TRMNL16-Regular.ttf") format("truetype")}
```

- Files: `TRMNL{12,16,21}-{Regular,Bold}.{woff2,woff,ttf}`. Bold is declared as `font-weight:bold` on the same family name.
- URLs are root-relative (`/fonts/...`), so they resolve against whichever host serves the CSS.
- No `font-display` descriptor is set anywhere in the stylesheet.
- `plugins.css` is 19 MB uncompressed. Do not load it for the sake of three fonts; write the `@font-face` rules by hand.

### Smoothing and line height

**[source]** the `.trmnl .screen` rule in `plugins.css` (the TRMNL bundle is the default; `.screen--fonts-trmnl` repeats it):

| Token | Family | Size | Line height | Smoothing | Weight |
| --- | --- | --- | --- | --- | --- |
| `--font-small-*` (`text--small`) | TRMNL12 | 12px | 1 | none | — |
| `--font-base-*` (`text--base`) | TRMNL16 | 16px | 1.25 | none | — |
| `--font-large-*` (`text--large`) | TRMNL21 | 21px | 1 | none | — |
| label | TRMNL16 | 16px | 1.25 | none | 700 |
| label small, description, item index | TRMNL12 | 12px | 1 | none | 400 |
| title | TRMNL21 | 21px | 1 | none | 400 |
| title small, title bar | TRMNL16 | 16px | 1 | none | 700 |
| rich text | TRMNL16 | 16px | 22px | none | 400 |
| rich text small | TRMNL12 | 12px | 16px | none | 400 |
| rich text large | TRMNL21 | 21px | 1 | none | 400 |

The smoothing token is applied as a single property, for example `.trmnl .label{...-webkit-font-smoothing:var(--label-font-smoothing)...}`. The stylesheet contains no `-moz-osx-font-smoothing`, `font-smooth` or `text-rendering` declaration. Inter sizes use `-webkit-font-smoothing: auto`.

So TRMNL's guidance is: **pixel faces at native size, `-webkit-font-smoothing: none`, line height 1 for single lines and 1.25 (16px face) or 16px/22px for running text.** All resulting line boxes are whole pixels.

Two consequences for this repo:

- `src/app/globals.css` currently sets `-webkit-font-smoothing: antialiased` globally and defines 14, 20 and 24 px sizes. Text in the TRMNL faces must override smoothing to `none` and sit at 12, 16 or 21 px. **[source]** this repo
- `-webkit-font-smoothing` is honoured by Chrome and Safari on macOS only; on Linux Chrome it has no effect **[inferred]** from general browser behaviour, not tested against TRMNL's renderer. Crispness on the device therefore depends on the glyphs landing on whole pixels (native size, integer positions), which is also why TRMNL ships its Pixel Perfect script. The page explains the failure mode: "anti-aliased gray pixels are forced to become either fully black or fully white. The result is text that appears randomly bold or distorted" (<https://trmnl.com/framework/docs/3.4/pixel_perfect.md>).

## 3. Reliability of loading from `trmnl.com`

### How the Screenshot plugin loads the page

**[docs]** <https://help.trmnl.com/en/articles/10302121-screenshot>:

> TRMNL does not visit this website directly and take a screenshot.

> TRMNL has a 5 second timeout for screenshots.

> Our screenshot generation service is in Germany.

> If you have control over the web page you are screenshotting, we suggest ensuring that styles and other externally included libraries are available with absolute URLs instead of relative paths.

The article says the page's HTML is copied into a new browser. Consequence **[inferred]**: the document is not rendered at the dashboard's own origin, so every font request is cross-origin wherever the files live. A web font loaded cross-origin needs an `Access-Control-Allow-Origin` response header, and the `@font-face` URL must be absolute. This applies equally to self-hosted files on Vercel.

### Live measurements

**[tested]** `curl` against `https://trmnl.com/fonts/`:

| File | Status | Size |
| --- | --- | --- |
| `TRMNL12-Regular.woff2` | 200 | 40,040 B |
| `TRMNL12-Bold.woff2` | 200 | 39,964 B |
| `TRMNL16-Regular.woff2` | 200 | 43,656 B |
| `TRMNL16-Bold.woff2` | 200 | 44,348 B |
| `TRMNL21-Regular.woff2` | 200 | 52,352 B |
| `TRMNL21-Bold.woff2` | 200 | 50,468 B |

Three Regular faces total 136 KB; all six total 271 KB.

Response headers (`TRMNL16-Regular.woff2`):

```
content-type: font/woff2
cache-control: public, max-age=14400
last-modified: Fri, 06 Nov 2026 13:30:46 GMT
vary: Accept-Encoding, Origin
via: 1.1 Caddy
cf-cache-status: HIT
server: cloudflare
access-control-allow-origin: *          (sent when an Origin header is present)
access-control-allow-methods: GET, OPTIONS
```

- CDN: Cloudflare in front of a Caddy origin. Edge cache was `HIT` on one file and `MISS` on another in the same minute.
- Cache lifetime is 4 hours, with no `immutable` and no `ETag`.
- CORS is open to any origin.

Timing: 24 sequential cold-connection requests (8 rounds of the three Regular WOFF2 files, each including DNS, TCP and TLS). All returned 200. Total time ranged from **91 ms to 306 ms**, median about 185 ms. An earlier single pass over all six files ranged from 186 ms to 444 ms.

Limits of this test: it was run from Sydney, not from TRMNL's screenshot service in Germany, and over about one minute. It shows the files are small and the CDN is quick; it says nothing about availability over months.

### Are the URLs versioned?

No. **[tested / source]** The paths are plain (`/fonts/TRMNL16-Regular.woff2`) with no fingerprint or version segment, although the CSS is versioned (`/css/3.4.0/plugins.css` and `/css/latest/plugins.css` both return 200).

The files behind those URLs have already changed in place. **[source]** <https://trmnl.com/fonts/CHANGELOG.md> records v1.000 → v1.001 (2026-07-24, metric changes including "hmtx | space | 392 | 384 | 6.125px | 6px | THE REPORTED BUG") → v1.002 (licence metadata). It also says: "Design decisions D1–D10 from the audit report still await Heavyweight's sign-off", so further revisions are likely. A metric change alters text widths and can move line breaks on a fixed 800x480 layout without any change on this side.

### Assessment

**[inferred]**

- Speed is not the problem. Three 40 to 52 KB files from Cloudflare fit comfortably inside 5 seconds.
- Hotlinking adds a third-party dependency to every 15-minute render: if `trmnl.com` is slow, blocks the request, changes the path or changes CORS, the screenshot falls back to another font or renders text late. Nothing documents these URLs as a public CDN.
- Hotlinking also accepts silent font revisions.
- Self-hosting on Vercel removes both, at the cost of 136 to 271 KB in the repo and two things to get right: an absolute URL in `@font-face` and an `Access-Control-Allow-Origin` header on the font path. `next.config.ts` currently sets no headers and no asset prefix **[source]** this repo, so this needs configuring and checking against a real Screenshot render.
- The dashboard already depends on a third party for the title font: `src/app/globals.css` imports Inter from `fonts.googleapis.com`. Self-hosting Inter the same way would remove the last external font request.

## 4. Fallback faces

Not needed, since the TRMNL faces may be used. Recorded for completeness.

| Face | Designer | Licence | Native size | Evidence |
| --- | --- | --- | --- | --- |
| NicoClean | Emily Huo (emhuo), <https://emhuo.itch.io/nico-pixel-fonts-pack> | SIL OFL 1.1 | 16px | **[docs]** <https://trmnl.com/fonts/bundles/classic/README.md>; **[source]** name 13 in the file: "Copyright (c) 2021, Emily Huo ... This Font Software is licensed under the SIL Open Font License, Version 1.1." followed by the full licence text |
| NicoPups | Emily Huo | SIL OFL 1.1 | 16px (the framework sets it at 16px for its "small" slot) | Same sources; same embedded text |
| BlockKie | JoohnFonts, built with FontStruct, <https://fontstruct.com/fontstructions/show/2042137/blockkie> | CC BY 3.0 | 26px | **[docs]** classic README; **[source]** name 13 `Creative Commons Attribution`, name 14 `http://creativecommons.org/licenses/by/3.0/`, name 0 `Copyright JoohnFonts 2021` |
| Inter (variable) | Rasmus Andersson | SIL OFL 1.1 | scalable | **[source]** name 13 in `Inter.ttf` v4.001: "This Font Software is licensed under the SIL Open Font License, Version 1.1." |

Notes:

- All three Classic faces are TTF only (93 KB, 70 KB and 1.15 MB). BlockKie's size makes it a poor fit for a 5-second render.
- BlockKie requires attribution (CC BY), which would have to appear in the repo. Its `fsType` is 4 (preview and print embedding), which sits oddly with CC BY; the licence text governs.
- The Classic faces are single weight; there is no bold.
- Fallback order if the TRMNL faces ever became unusable: NicoClean and NicoPups (OFL, same terms as now), then Inter throughout.

## Recommendation

1. **Use TRMNL12, TRMNL16 and TRMNL21.** The licence is SIL OFL 1.1, published in TRMNL's repository licence, its docs, the bundle, and the files themselves.
2. **Self-host them from the dashboard's own Vercel deployment**, committed to the repo. Take the unmodified WOFF2 files and `OFL.txt` from the official bundle (<https://trmnl.com/fonts/bundles/trmnl/trmnl-fonts--trmnl-only.zip>, 200 **[tested]**), keep `OFL.txt` beside them, and note in the repo that the fonts are OFL-licensed and separate from the repo's own licence.
3. Reference them with absolute URLs and serve them with `Access-Control-Allow-Origin: *`, because the Screenshot plugin renders a copy of the HTML away from the dashboard's origin.
4. Set them only at 12, 16 and 21 px, with `-webkit-font-smoothing: none`, whole-pixel line heights (1, or 1.25 for the 16px face), and only the weights 400 and 700.
5. Commit only the weights the design uses; each is 40 to 52 KB.

### Residual risk

- **Licence provenance.** The copyright holder is Heavyweight; every OFL statement found was published by TRMNL. The font changelog says the files originally shipped with "Heavyweight's retail EULA text (shipped in error — it contradicted the commissioning agreement, which licenses the fonts under SIL OFL 1.1)", and that TRMNL replaced that metadata itself in v1.002. The commissioning agreement is not public and no statement from Heavyweight was found. The risk that the OFL grant is invalid is low (TRMNL distributes the fonts under it in a public MIT repository and in a downloadable bundle), and the remedy if it ever were is to swap to NicoClean/NicoPups or Inter.
- **Drift from upstream.** Self-hosted copies will not pick up later corrections ("D1–D10 ... await Heavyweight's sign-off"). That is the intended trade: layout stability over automatic updates. Re-download deliberately if a glyph or spacing defect shows up.
- **Untested end to end.** Nothing here was rendered through the real Screenshot plugin. The CORS and absolute-URL requirements for self-hosted fonts are inferred from the help article and need one confirming render on the device. The effect of `-webkit-font-smoothing: none` in TRMNL's screenshot browser is likewise untested.
- **Reliability sample.** Timing was measured from Sydney over about a minute, not from Germany and not over time.

## Sources

- <https://github.com/usetrmnl/trmnl-framework> (`LICENSE`, `THIRD_PARTY_NOTICES.md`, `README.md`, `public/fonts/`, `app/assets/stylesheets/framework/config/_fonts.scss`, `public/framework/releases/3.1.0.md`), at commit `07a0b39e41c9a702e3f21834853d68720f96c170`
- <https://trmnl.com/framework/docs/3.4/font_family.md>
- <https://trmnl.com/framework/docs/3.4/open_source.md>
- <https://trmnl.com/framework/docs/3.4/text_size.md>
- <https://trmnl.com/framework/docs/3.4/pixel_perfect.md>
- <https://trmnl.com/fonts/bundles/trmnl/README.md> and <https://trmnl.com/fonts/bundles/trmnl/OFL.txt>
- <https://trmnl.com/fonts/bundles/classic/README.md>
- <https://trmnl.com/fonts/CHANGELOG.md>
- <https://trmnl.com/css/latest/plugins.css>
- <https://help.trmnl.com/en/articles/10302121-screenshot>
- Font files at `https://trmnl.com/fonts/` (name, head and OS/2 tables read from temporary copies; nothing was added to this repo)
