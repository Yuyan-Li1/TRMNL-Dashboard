# Media dashboard spec

The TRMNL dashboard is rebuilt as a media-only display: what the owner is playing, watching and reading, on one 800x480 four-grey screen. This folder is the staged spec. Every product and source decision is made here; an implementation session is handed this file plus one stage file.

Domain terms (Medium, Source, Catalog, Title, Spotlight, Mode, Medium card, Pool, Consumed, Collector, Stale, Alert) are defined in `GLOSSARY.md` at the repo root and are used here with those meanings.

## Stages

| #   | Stage                                                                  | What the device gains                                                           |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | [New screen with games](01-new-screen-with-games.md)                   | The new screen; games from Steam, Xbox, PSN and Switch                          |
| 2   | [Movies](02-movies.md)                                                 | Movies from Letterboxd; the Finished mode                                       |
| 3   | [Shows](03-shows.md)                                                   | Shows from Trakt, with Caught up                                                |
| 4   | [Alerts and status strip](04-alerts-and-status-strip.md)               | Nothing on the panel; Telegram Alerts, the status strip, the source health page |
| 5   | [Collector and books](05-collector-and-books.md)                       | Books from Goodreads, read by the home server                                   |
| 6   | [Consumed set and Catalog picks](06-consumed-set-and-catalog-picks.md) | The Recommendation mode, with Catalog picks                                     |
| 7   | [Friend activity](07-friend-activity.md)                               | Friends' Letterboxd ratings and reviews                                         |
| 8   | [LLM picks](08-llm-picks.md)                                           | LLM picks in the Pool; book Recommendations                                     |

Rules for every stage:

- **It leaves a working device.** A medium whose stage has not shipped shows an empty Medium card (see "A medium with nothing to show").
- **It is done when** CI passes, it is deployed to production, and the owner has checked the screen on the device. Items marked "device check" in a stage file are settled at that check, not before.
- **It is one stack** (`gh stack`), with the slices listed in the stage file as its branches, in order. A stage may take more than one implementation session.
- **Reachability check first.** A source never yet fetched from Vercel (Nintendo in stage 1, Letterboxd in stage 2) is tried with one request from a Vercel preview before anything is built on it. If it does not answer, that source moves to the Collector and ships with stage 5; the other stages keep their order.

## Architecture

- **Vercel** renders the screen and fetches the sources it can reach: Steam, Xbox, PSN, Switch, Trakt, the owner's Letterboxd feed, and the Catalogs TMDB and IGDB.
- **The Collector** (from stage 5) runs on the owner's home server, reached with `ssh homeserver`. It reads what Vercel cannot (Goodreads, the Letterboxd following list and friends' feeds), owns the consumed set, and makes LLM picks.
- **Redis (Upstash)** is the only store Vercel reads. Each cache write keeps a TTL'd key and a non-expiring `:latest` key, as today. MongoDB is removed in stage 1.
- **Key ownership**: every key the Collector writes starts with `home:`; Vercel never writes under it and the Collector never writes outside it. Each side may read the other's keys. The one shared prefix is `alert:` (per-failure Alert state), written by both.
- **The page is cache-first**: it never calls a source or Catalog while rendering.
- **The admin area** is login, the manual refresh button and, from stage 4, the source health page.

### What triggers a refresh

- GitHub Actions calls `POST /api/refresh` every 15 minutes, as today.
- From stage 5, the Collector's tick also calls the refresh itself when the last success is more than 30 minutes old. GitHub's schedule is often late and is disabled after 60 days of repo inactivity.
- From stage 6, a daily run writes each source's full history and rebuilds the Catalog picks.

## The screen

Chosen on the device from the prototype on branch `prototype/spotlight-screen` (never merged; variant G, poster recipe Q version 2).

### Layout

- The Spotlight's poster sits on the left edge in a 320x480 slot. It keeps the artwork's own aspect ratio, fitted inside the slot and centred, never cropped: a 2:3 movie poster fills it, a 3:4 IGDB cover is 320x427 with white above and below.
- A text column of about 276 px sits beside it.
- A rail of about 204 px on the right holds three Medium cards, stacked, separated by 2 px rules. The Spotlight's medium has no card; the other three do.
- **Text column, top to bottom**: the Mode in a black label with the Medium beside it; the title; a byline (author; year and director; platform; or season); the rating; the reason (Recommendation only); the facts; a progress bar where there is progress; then the review or description.

### Type

- TRMNL's pixel fonts (TRMNL12, TRMNL16, TRMNL21, Regular and Bold) for everything except the title, each only at its native size, with `-webkit-font-smoothing: none`: 21 px for facts, 16 px for body text, labels and card titles, 12 px for card details. Line height 1 for 12 and 21 px, 22 px for 16 px running text.
- The title is smoothed Inter Bold at 32 px, up to three lines.
- The TRMNL fonts are SIL OFL 1.1. They are self-hosted in this repo with `OFL.txt` and the copyright notice, served with absolute URLs and an `Access-Control-Allow-Origin` header, because the Screenshot plugin renders the HTML away from the dashboard's origin.

### Ratings

- Every rating is five stars with half stars, followed by whose it is: "You", the friend's name, or the Catalog's name (TMDB, IGDB, Goodreads). A public rating is converted to five stars.
- The owner's rating appears on a Finished title, a friend's on a Friend activity entry, the public rating on a Recommendation. An In progress title shows no rating.

### Text

- A friend's review: up to 280 characters.
- A Recommendation: a reason of at most 100 characters and a description cut to about 140.
- An In progress Spotlight shows the Catalog description under its facts.
- A Finished Spotlight shows the owner's review if the source has one, otherwise the Catalog description.

### Medium cards

- A thumbnail, the Medium's name, the title (two lines at most), stars when the latest activity has the owner's rating, one detail line (hours played; episode and "caught up"; page of pages; or "Watched") and when it happened.
- The thumbnail keeps the artwork's own aspect ratio, fitted inside a 64x96 slot, never cropped.
- A card always shows the medium's latest activity, however old.

### Posters

- Posters are dithered by us when data is refreshed, never at render time and never by TRMNL. The four-grey PNG is stored in Redis and embedded in the page as a data URI, shown 1:1 with `image-rendering: pixelated`. `next/image` is not used.
- **Recipe**: resize to fit inside the target, never cropped; greyscale; normalise, clipping 0.5% at each end; brighten with our own lookup-table curve chosen so the mean reaches 0.45, never darkening, gamma capped at 2.6 (`sharp`'s `.gamma()` does not brighten and is not used); sharpen with sigma 0.8; serpentine Floyd-Steinberg in linear light to the four even greys `#000`, `#555`, `#aaa`, `#fff`; 4-colour palette PNG.
- **Thumbnails** are made from the source image, not from the large poster: fitted (not cropped) into 64x96, the same lift, sharpen sigma 0.6, 75% of the dithering error passed on. Untested on the device; tuned at stage 1's device check.
- A title without artwork is not eligible for the Spotlight. Artwork is looked for in the Catalog first, then in the source.
- Grey specks in white areas are e-ink ghosting, not our image. Nothing is done about them.

### Device limits

- TRMNL OG, firmware 1.8.18, "4 grays 2 bit" palette, Screenshot plugin pointed at `https://trmnl.yuyanli.dev`, refreshing every 15 minutes.
- The page must render within 5 seconds, all URLs absolute, and the final screen image must be under 90,000 bytes.
- No gradients and no lines thinner than 2 px.

## Modes and Spotlight rotation

- **Four Modes**: In progress, Finished, Friend activity, Recommendation.
- **Shares**: In progress 35%, Finished 25%, Friend activity 20%, Recommendation 20%. A Mode with nothing eligible is skipped and the rest share its weight in proportion. Until a Mode's stage ships it simply has nothing eligible.
- **Within a Mode**, fresher activity is favoured: a title's weight is `1 / (1 + days since its activity)`.
- **The Spotlight is re-picked on every render of the dashboard page** and is never the same Title twice in a row. The previous pick is kept in Redis.
- **Eligibility window**: 14 days for a Finished title, a friend's entry, and an In progress game or show.

| Medium | In progress                                                                | Finished                               |
| ------ | -------------------------------------------------------------------------- | -------------------------------------- |
| Game   | Played in the last 14 days                                                 | Never                                  |
| Movie  | Never                                                                      | Logged in the diary                    |
| Show   | Episode watched in the last 14 days, including Caught up                   | Season or show ended and fully watched |
| Book   | On the currently-reading shelf, with a progress update in the last 14 days | Marked as read                         |

### A medium with nothing to show

- A Medium card with no title at all shows the Medium's name and "Nothing yet".
- When no title is eligible for the Spotlight in any Mode, the Spotlight is the most recently active title that has artwork, in its own Mode, ignoring the 14-day window.
- When the home server has been unreachable for a long time the screen does nothing special: the last good books, friends' entries and picks stay, and age out of the Spotlight by the rules above. The Alert and the status strip are the only signal.

## Sources and Catalogs

| Medium  | Source                                             | Read by   | Stage |
| ------- | -------------------------------------------------- | --------- | ----- |
| Game    | Steam, Xbox (OpenXBL), PSN, Nintendo Switch        | Vercel    | 1     |
| Movie   | Letterboxd public diary feed                       | Vercel    | 2     |
| Show    | Trakt, client id only                              | Vercel    | 3     |
| Book    | Goodreads, no login                                | Collector | 5     |
| Friends | Letterboxd following list and friends' diary feeds | Collector | 7     |

| Catalog   | For           | Called from          | Notes                                                                                              |
| --------- | ------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| TMDB      | Movies, shows | Vercel only          | Free key. Attribution notice and logo required. Cached data must not be kept longer than 6 months. |
| IGDB      | Games         | Vercel and Collector | Twitch app token, about 60 days. 4 requests per second.                                            |
| Goodreads | Books         | Collector only       | Unofficial endpoints.                                                                              |

**TMDB and the LLM**: TMDB's terms forbid use in connection with an AI application. The LLM never receives TMDB data, TMDB is never called from the Collector, and LLM-named movies and shows are confirmed through Trakt search.

## Environment variables

Removed in stage 1: `MONGODB_URI`, `TFNSW_API_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`.

| Variable                                          | Where                          | From stage |
| ------------------------------------------------- | ------------------------------ | ---------- |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (IGDB) | Vercel; Collector from stage 6 | 1          |
| `NINTENDO_SESSION_TOKEN`                          | Vercel                         | 1          |
| `LETTERBOXD_USERNAME`, `TMDB_API_KEY`             | Vercel                         | 2          |
| `TRAKT_CLIENT_ID`, `TRAKT_USER_SLUG`              | Vercel; Collector from stage 8 | 3          |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`          | Vercel; Collector from stage 5 | 4          |
| `GOODREADS_USER_ID`, `CLAUDE_CODE_OAUTH_TOKEN`    | Collector                      | 5          |

The Collector's `.env` also holds the Upstash credentials, the dashboard URL and `CRON_SECRET`. `.env.local` is blocked to agents by a deny rule, so the owner adds every secret by hand, locally and in Vercel.

## Not in this spec

Recorded as possible later efforts. None is decided in enough detail to build.

- The Goodreads logged-in session, adding real finish dates and friends' book updates as Friend activity. If the Goodreads widget is retired, books freeze on their last good data and this becomes the replacement, as a new effort.
- Steam friends' reviews as Friend activity.
- Keeping watchlists and to-read shelves current, so a title the owner has already listed is not recommended.
- A more convenient way than SSH to edit taste models and "also consumed" files.
- Taste models for movies and shows. The owner writes them whenever they like; a medium without one runs on history alone.

Ruled out: weather, transit, calendar, routines, medication, day types, time blocks and special conditions; Trakt for movies or friends; Xbox and PSN friends; moving books off Goodreads; calling Claude from Vercel or through the Agent SDK; Open Library; a dismiss button for Recommendations.

## Research behind the spec

Each is a Markdown file on a pushed, never-merged branch.

| Branch                                     | File                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `research/goodreads-no-login-surface`      | `docs/research/goodreads-no-login-surface.md`                          |
| `research/catalog-capabilities`            | `docs/research/catalog-capabilities.md`                                |
| `research/trakt-finished-season-detection` | `docs/research/trakt-finished-season-detection.md`                     |
| `research/trmnl-image-rendering`           | `docs/research/trmnl-image-rendering.md`                               |
| `research/dark-artwork-on-2-bit-panel`     | `docs/research/dark-artwork-on-2-bit-panel.md`                         |
| `research/trmnl-font-licence-and-hosting`  | `docs/research/trmnl-font-licence-and-hosting.md`                      |
| `prototype/spotlight-screen`               | route `/prototype/spotlight`, `scripts/prototype-spotlight-dither.mjs` |
