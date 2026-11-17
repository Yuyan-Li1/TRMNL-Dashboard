# Stage 1: New screen with games

Read [the overview](README.md) first. This stage removes the old dashboard and ships the new screen with one medium, games. The Spotlight has one Mode, In progress. The movie, show and book Medium cards read "Nothing yet".

## Before building

**Reachability check**: from a Vercel preview, exchange `NINTENDO_SESSION_TOKEN` for an access token and send one `GET https://app-api.znej.nintendo.com/api/v2.0/users/me/play_histories`. If Nintendo does not answer from Vercel, Switch is left out of this stage and is read by the Collector in stage 5.

## Slices

### 1. Remove the old dashboard

- Delete the schedule system (`src/lib/schedule/`, `/api/schedule`, the schedule and routine admin pages and API routes, `ScheduleEditor`), the weather, transit, calendar, routine and medication widgets and the alert banner, their API clients and types, and the commute and location config.
- Delete MongoDB entirely: `src/lib/db/`, Mongoose, `pnpm db:seed`, and its env group.
- The admin area keeps login and the refresh button.
- Until stage 4 replaces them, the two GitHub issue workflows stay alive in a cut-down form: `/api/health` checks Redis only, and `/api/tokens` reports only the live PSN token check.
- Delete `morning-prefetch.yml` and the old `docs/00` to `docs/09` files.
- Rewrite `CLAUDE.md` for the new architecture.

### 2. Fonts

- Commit the six TRMNL font files (TRMNL12, TRMNL16, TRMNL21, Regular and Bold, WOFF2) with `OFL.txt` and the copyright notice (Heavyweight Digital Type Foundry).
- Serve them with absolute URLs and `Access-Control-Allow-Origin: *`, set in `next.config.ts`.
- Replace the `antialiased` setting and the 14, 20 and 24 px sizes in `globals.css` with the sizes and smoothing in the overview. Inter Bold is loaded for the title only.

### 3. Poster pipeline

- Implement the recipe in the overview as one module that takes a source image URL and a target (Spotlight 320x480 cover crop, or thumbnail fitted in 64x96) and returns a 4-colour PNG. `sharp` cannot dither to a fixed palette, so the dithering step is our own loop.
- It runs during the refresh. The result is stored in Redis keyed by source URL and target, and reused until the source URL changes.

### 4. Game sources and IGDB

- **Steam**: as today.
- **Xbox**: OpenXBL `player/titleHistory`. The response is wrapped as `{ content: { titles }, code }`; `src/lib/api/xbox.ts` reads `titles` at the top level today and gets nothing. Fix it.
- **PSN**: `getUserPlayedGames`, which carries last played date and play duration. Keep only entries whose `category` contains `game` (the rest are apps such as Netflix and Plex).
- **Switch**: the endpoint above, with a `Gentry-Locale` header. `en-GB` is known to work and `en-AU` returns 400; try `en-US` first, as the account is US-region. Each title has `titleName`, `platform` (`BEE` is Switch 2, `HAC` the original Switch), `imageUrl`, `lastPlayedAt` and `totalPlayedMinutes`. The data updates once a day, so fetch it at most hourly. The per-day minutes are ignored.
- **One Title per game**: a game played on several Platforms, or on both Switch and Switch 2, is one Title showing the Platform it was most recently played on, with hours summed. Titles are matched by cleaned name.
- **Name cleaning**, for matching and display: drop "– Nintendo Switch 2 Edition" and anything after it, drop "for Nintendo Switch", and fix all-caps names.
- **IGDB**: get a Twitch app token (about 60 days; cache it in Redis and renew before expiry). For each recently played Title fetch `cover.image_id`, `summary` and `total_rating`. Match a Steam game by app id through `external_games.uid`; if that returns nothing, and for every other Platform, match by name search.
- **Artwork**: the IGDB cover on every Platform. The Platform's own image is the fallback when IGDB has no match (Nintendo's is a square icon, at 512 or 1024 px).
- Defaults, to revisit only if they look wrong on the device: "Nintendo Classics" collections appear as ordinary titles, and titles hidden on the Nintendo profile stay hidden.

### 5. The screen

- Build the layout, Medium cards and Spotlight picker described in the overview.
- **A game in the Spotlight**: Mode label "In progress" with "Game"; title; byline is the Platform; no rating; facts are total hours and last played; then the IGDB summary.
- **The games Medium card**: thumbnail, title, hours played, when last played.
- Only In progress exists in this stage. With no game played in the last 14 days, the fallback rule in the overview applies.

## Device checks

- The poster recipe at 320x480 and on thumbnails: tune the lift and the thumbnail settings until the owner accepts a dark and a light cover.
- The self-hosted TRMNL fonts load through the Screenshot plugin and render crisply unsmoothed.
- The whole-screen image is under 90,000 bytes.
- All four greys display.
