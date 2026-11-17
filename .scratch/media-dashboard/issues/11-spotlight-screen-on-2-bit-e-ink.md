# Spotlight screen on 2-bit e-ink

Type: prototype
Blocked by: 04, 10, 16
Assignee: Yuyan Li
Status: resolved

## Question

What does the screen look like at 800x480 in four grey levels?

Build a rough, throwaway version of the screen with real titles and real artwork so the owner can react to it:

- The Spotlight in each mode: In progress, Finished, Recommendation and, if agreed, Friend activity with a rating and review text.
- The Medium cards beside it.
- Posters dithered as [TRMNL image rendering](10-trmnl-image-rendering.md) recommends.

Decide from it: the Spotlight's proportions, how much review or description text fits, how ratings are drawn, and what each Medium card shows.

## Answer

Resolved 2026-11-17 by prototype, judged by the owner in the browser and then on the device. The prototype is on the throwaway branch `prototype/spotlight-screen` (never merged): route `/prototype/spotlight`, `?variant=A|B|C|F|G|P|Q|T&scene=1..10`, artwork from `node scripts/prototype-spotlight-dither.mjs`. Variant G is the chosen screen; Q version 2 is the chosen poster recipe. The history of each test is in the comments below.

### Layout

- **Layout A**: the Spotlight's poster fills the left edge at 320x480; a text column of about 276 pixels sits beside it; a rail of about 204 pixels on the right holds the three Medium cards, stacked and separated by 2-pixel rules.
- **Text column, top to bottom**: the Mode in a black label with the Medium beside it; the title; a byline (author, year and director, platform, or season); the rating; the reason (Recommendation only); the facts; a progress bar where there is progress; then the review or description.

### Type

- TRMNL's own pixel fonts (TRMNL12, TRMNL16, TRMNL21, regular and bold) for everything except the title, each used at its named size with font smoothing off: 21px for facts, 16px for body text, labels and card titles, 12px for card details.
- The title is smoothed Inter bold at 32px, up to three lines. The pixel font at 42px was judged too pixelated; Inter for body text was judged rougher than TRMNL's font.
- The prototype loads the fonts from `trmnl.com`. Whether they may be self-hosted is the ticket [TRMNL font licence and hosting](21-trmnl-font-licence-and-hosting.md).

### Ratings

- Every rating is drawn as five stars with half stars, followed by whose it is: "You", the friend's name, or the Catalog's name (TMDB, IGDB, Goodreads). A public rating is converted to five stars.

### Text

- A friend's review shows up to 280 characters; that length fitted the text column on the device with the Inter title.
- A Recommendation shows a reason of about 100 characters and a description of about 140, as [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md) set; both fit.
- An In progress Spotlight shows the Catalog description under its facts, so the column is not left half empty.

### Medium cards

- Each shows a thumbnail, the Medium's name, the title (two lines at most), stars when the latest activity has the owner's rating, one detail line (hours played, episode and "caught up", page of pages, or "Watched") and when it happened.
- The thumbnail keeps the artwork's own aspect ratio, fitted inside a 64x96 slot and never cropped.

### Posters

- We dither posters ourselves; the device test confirmed our four-grey PNG passes through TRMNL's Screenshot conversion cleanly and beats letting TRMNL convert a colour image. All four greys display, so Maximum Compatibility is off.
- **Recipe** (Q version 2, chosen by the owner as slightly better than round one's adaptive gamma, and good on both a dark and a light poster): resize to exact pixels with a cover crop; greyscale; normalise clipping 0.5% at each end; brighten with our own curve chosen so the mean reaches 0.45, never darkening, gamma capped at 2.6; sharpen with sigma 0.8; serpentine Floyd-Steinberg in linear light to the four even greys; 4-colour PNG shown 1:1.
- Dithering against the panel's measured greys, and local contrast, were rejected: both wash out a light poster. Background in [Preparing dark artwork for the 2-bit panel](20-preparing-dark-artwork-for-the-2-bit-panel.md).
- Grey specks in white areas are e-ink ghosting, not part of our image.

### Not tested, left to implementation

- The chosen recipe was judged at 188x282, not at the Spotlight's 320x480, and never on thumbnails.
- The In progress description fill and the final screen (variant G with the chosen recipe) were not photographed on the device.
- Largest dithered 320x480 poster was about 24 KB; the whole-screen image against TRMNL's 90,000-byte limit was not measured.

## Comments

- 2026-11-17: prototype built and pushed to the throwaway branch `prototype/spotlight-screen` (never merged). Route `/prototype/spotlight`, `?variant=A|B|C|T&scene=1..10`. Artwork is regenerated with `node scripts/prototype-spotlight-dither.mjs`.
- 2026-11-17, owner, from the browser: layout A (320x480 poster on the left, text column, rail of three Medium cards on the right); ratings drawn as stars; Medium cards keep their thumbnails, and a thumbnail keeps the artwork's own aspect ratio (fitted inside a 64x96 slot, never cropped).
- 2026-11-17: seen in screenshots, not on the device: a 280-character review and a 97-character reason plus a 140-character description both fit layout A; the largest dithered 320x480 poster is about 24 KB.
- Still open: the on-device test (variant T). The Vercel preview `https://trmnl-dashboard-3mk1ehojc-yuyanli1s-projects.vercel.app` built, but Vercel Authentication redirects every request to a login, so TRMNL cannot fetch it yet.
- Still open: what fills the empty space of an In progress Spotlight, and whether a public rating is drawn the same way as the owner's.
- 2026-11-17, on the device (variant T, owner's photo): all four greys show as distinct, so 2-bit output is working. Our pre-dithered PNG passes through TRMNL's conversion cleanly and the owner judged it good. TRMNL also dithers an untouched colour JPEG itself, but the result is darker and muddier; the posterised image loses the face. Decision: pre-dither ourselves, as the research recommended.
- 2026-11-17, owner: wants TRMNL's own font. TRMNL's framework stylesheet (`https://trmnl.com/css/latest/plugins.css`) declares pixel faces TRMNL12, TRMNL16 and TRMNL21, each Regular and Bold, used with font smoothing off; the files under `https://trmnl.com/fonts/` are served with `access-control-allow-origin: *`. Their licence for self-hosting was not checked. Variant F sets layout A in them (title 42px, facts 21px, body 16px, card details 12px). The face is wider than Inter: the 280-character review no longer fits and is cut off after about 230 characters. Latest preview: `https://trmnl-dashboard-hr4achbsa-yuyanli1s-projects.vercel.app`.
- 2026-11-17, on the device (variant A in Inter, scenes 7 and 1, owner's photos): layout A holds up; the full 280-character review is shown and readable; stars, including the half star, are clear at both sizes. Inter's edges are rough because smoothed text is reduced to four greys, most visibly in the 12px card details. A mostly dark poster (Perfect Days) loses its lower half to near-black, while a mid-tone one (Silksong) is clean, so the dithering step needs to lift dark artwork. The In progress game leaves the lower half of the text column empty.
- 2026-11-17, owner, on the device (variant F): TRMNL's font is better than Inter, but too pixelated for the title at 42px. Variant G keeps TRMNL's font everywhere except the title, which is smoothed Inter bold at 32px. Awaiting the owner's verdict on the device.
- 2026-11-17, owner: yes to filling an In progress Spotlight with the Catalog description, and yes to drawing public ratings as stars with the source's name beside them.
- 2026-11-17, owner: the white background shows grey pixels on close inspection. Unexplained. The prototype's surround was beige outside the 800x480 frame; it is now pure white to test whether that was the cause.
- 2026-11-17: dark posters are now the research ticket [Preparing dark artwork for the 2-bit panel](20-preparing-dark-artwork-for-the-2-bit-panel.md). Variant P shows four preparations of one poster for the device (`?variant=P&scene=7` Perfect Days, `scene=8` Dune: Part Two, `scene=1` Silksong, `scene=6` Piranesi). Latest preview: `https://trmnl-dashboard-ibdgwk981-yuyanli1s-projects.vercel.app`.
- 2026-11-17, owner, on the device: the smoothed Inter title of variant G is better than the pixel title. The white background is still speckled with grey pixels after the surround was made pure white, so the page's surround is not the cause; TRMNL's conversion of the screenshot is the suspect, unconfirmed.
- 2026-11-17, on the device (variant P, owner's photo of Perfect Days): the first-test version and "panel levels" alone both stay too dark; adaptive gamma (2) shows the room while keeping contrast; local contrast plus gamma plus panel levels (4) shows the most detail but looks flat and grey. The owner has not yet picked.
- 2026-11-17, owner: on close inspection the grey specks in white areas are e-ink ghosting (leftover shadows of the previous image), not pixels in our image. Nothing to fix on the page.
- 2026-11-17, on the device (variant P, Silksong, owner's photo): a mid-tone poster survives all four preparations; adaptive gamma (2) does no harm to it, and the local-contrast version (4) is again the flattest.
- 2026-11-17: research reported in [Preparing dark artwork for the 2-bit panel](20-preparing-dark-artwork-for-the-2-bit-panel.md). Variant Q is a second tuning round following it: 1 is round one's adaptive gamma, 2 adds linear-light serpentine dithering, 3 dithers against panel levels 0/32/107/255, 4 adds mild local contrast. Latest preview: `https://trmnl-dashboard-34f24eajj-yuyanli1s-projects.vercel.app`.
- 2026-11-17, on the device (variant Q, owner's photos of Perfect Days and Dune: Part Two): on the dark poster, the two panel-level versions (3, 4) show the most room detail and round one's adaptive gamma (1) is close behind; linear-light dithering with even levels (2) is slightly darker than 1. On the light poster, 1 and 2 keep depth and the title lettering, while 3 and 4 wash the figures out. Version 1 is the only one that is good on both. The owner has not yet picked.
