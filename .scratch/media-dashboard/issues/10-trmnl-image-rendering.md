# TRMNL image rendering

Type: research
Status: resolved

## Question

How does a poster or cover image end up on the TRMNL's 2-bit screen, and what gives the best result?

- How TRMNL turns this project's rendered page into the device image (screenshot, colour reduction, dithering), for the way this repo is connected to the device. Check the repo to see which integration it uses.
- Whether TRMNL dithers images itself or expects pre-dithered input, and what its own design guidance says about photographs and artwork.
- Recommended techniques for dithering posters to four grey levels server-side, and whether that is preferable to letting TRMNL convert.
- Any limits on image size, count or load time within the 5-second render budget.

## Answer

Full findings: `docs/research/trmnl-image-rendering.md` on branch `research/trmnl-image-rendering` (pushed, never merged). It ends with a prototype checklist. Nothing was run; the pipeline claims are from TRMNL's documentation and the recommendation is inferred.

- **Integration**: most likely TRMNL's hosted Screenshot plugin (about 85% confident, inferred from the repo). `docs/09-deployment.md` describes a setup that matches no documented plugin.
- **Pipeline**: TRMNL loads the page in its own browser, screenshots it at 800x480 with a 5-second timeout, and converts it server-side. Image sources must be absolute URLs. How Screenshot output is quantised is undocumented.
- **Device settings that matter**: four greys need firmware 1.6 or later, the 4-grey colour palette setting, and Maximum Compatibility off. The final image must be under 90,000 bytes on the original device.
- **Recommendation**: dither posters ourselves during the data refresh, not at render time. Resize to exact pixels, convert to greyscale, normalise, adjust levels and gamma, sharpen lightly, then Floyd-Steinberg to black, two greys and white. sharp cannot dither to a fixed palette, so that step is a small custom loop. Serve as a lossless PNG at 1:1 with `image-rendering: pixelated`.
- **Avoid `next/image`** for posters: it emits relative URLs, lazy-loads and re-encodes. Use a plain `<img>` with an absolute URL or a data URI.
- **Unverified**: that a four-level image passes through TRMNL's conversion unchanged. The prototype must test this on the device.

Settings that cannot be read from the repo are now a task: [Confirm TRMNL device settings](16-confirm-trmnl-device-settings.md).
