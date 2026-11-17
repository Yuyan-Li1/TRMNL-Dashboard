# TRMNL font licence and hosting

Type: research
Status: resolved

## Question

May this dashboard use TRMNL's own fonts (TRMNL12, TRMNL16, TRMNL21), and where should the files be served from?

[Spotlight screen on 2-bit e-ink](11-spotlight-screen-on-2-bit-e-ink.md) chose these fonts for all text except the title. The prototype loads them from `https://trmnl.com/fonts/`, which answers with `access-control-allow-origin: *`.

- What licence the fonts carry, and whether a page outside TRMNL's framework may use them, load them from `trmnl.com`, or host copies itself.
- The sizes each face is designed for, and TRMNL's guidance on smoothing and line height.
- Whether loading three faces from `trmnl.com` is reliable inside the Screenshot plugin's 5-second capture, or whether self-hosting is the safer route.
- The fallback if they may not be used: the older NicoClean, NicoPups and BlockKie faces, or Inter.

## Answer

Full findings: `docs/research/trmnl-font-licence-and-hosting.md` on branch `research/trmnl-font-licence-and-hosting` (pushed, never merged). Each claim there is labelled by how it was established.

Use the TRMNL fonts, and self-host them.

- **Licence**: TRMNL12, TRMNL16 and TRMNL21 are SIL OFL 1.1, copyright Heavyweight Digital Type Foundry, commissioned by TRMNL. This is stated in the `usetrmnl/trmnl-framework` `LICENSE`, the framework's Open Source page, the font bundle's `OFL.txt` and the font files' own name table. No Reserved Font Name is declared.
- **What that permits**: use outside the framework, loading from `trmnl.com`, and committing copies to a public repo, provided `OFL.txt` and the copyright notice go with the files.
- **Sizes**: 12, 16 and 21 px only, Regular and Bold. The docs say the faces render correctly only at their native sizes.
- **Smoothing and line height**: the framework sets `-webkit-font-smoothing: none`, line-height 1 for 12 and 21 px and 1.25 for 16 px, or 16px/22px for running text. The repo's `globals.css` currently sets `antialiased` and uses 14, 20 and 24 px sizes.
- **Why self-host**: the `trmnl.com` URLs are unversioned and the files have already been replaced in place (v1.000 to 1.002, with spacing changes), with more revisions pending. Speed is not the problem: six WOFF2 files of 40 to 52 KB each returned in 91 to 306 ms behind Cloudflare.
- **What self-hosting needs**: absolute font URLs and an `Access-Control-Allow-Origin` header, because the Screenshot plugin renders a copy of the HTML away from the dashboard's origin. `next.config.ts` sets neither today.
- **Fallback, not needed**: NicoClean and NicoPups are OFL 1.1, BlockKie is CC BY 3.0, Inter is OFL 1.1.

Not established:

- Every OFL statement comes from TRMNL, not from Heavyweight. The font changelog says the files first shipped with Heavyweight's retail EULA in error and TRMNL corrected the metadata itself.
- Nothing was tested through the real Screenshot plugin, so the CORS requirement and the effect of unsmoothed text there are inferred.
- Timing was measured from Sydney over about a minute; the screenshot service is in Germany.
