# CLAUDE.md - AI Agent Instructions

## Project Overview

A TRMNL e-ink dashboard that shows one person's media activity: what they are playing, watching and reading, on one 800x480 four-grey screen. Built with Next.js and TypeScript, hosted on Vercel (Hobby plan).

The dashboard is being rebuilt in stages. The staged spec is `docs/spec/media-dashboard/` (start with its `README.md`); it holds every product and source decision. Domain language is in `GLOSSARY.md`. Stages 1 (games), 2 (movies), 3 (shows), 4 (Alerts and the status strip) and 5 (the Collector and books) are built. The Collector (`collector/`) runs on the owner's home server, not on Vercel.

## Tech Stack

- **Runtime**: Node.js 20+ on Vercel; Node.js 22.13+ for the Collector and the tests (`node:sqlite`)
- **Package Manager**: pnpm (required)
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **React**: 19 (with React Compiler enabled)
- **Store**: Upstash Redis, the only store Vercel reads; SQLite (`node:sqlite`) is the Collector's record on the home server
- **Styling**: Tailwind CSS 4 (e-ink optimized)
- **Formatter**: Oxfmt
- **Linter**: Oxlint
- **Deployment**: Vercel Hobby plan
- **Scheduling**: GitHub Actions (workaround for Vercel cron limits)

## Git Workflow (gh stack)

This project uses GitHub stacked PRs through the official [`gh stack`](https://gh.io/stacks) extension (`gh extension install github/gh-stack`). Every change starts as a stack, even when it has only one branch.

```bash
# Start a stack with its first branch (based on main)
gh stack init <branch-name>

# Commit as usual, then add the next branch on top when the change splits
gh stack add <next-branch-name>

# Push every branch and create or update the PRs
gh stack submit                # interactive editor for titles and bodies
gh stack submit --auto --open  # non-interactive: auto titles, ready for review

# Fetch, rebase the stack onto main, and push
gh stack sync

# Resolve conflicts when sync reports one
gh stack rebase

# Merge the stack (all or nothing)
gh stack merge --yes --squash

# Inspect and move around
gh stack view
gh stack up / down / top / bottom
```

Agents run in a non-interactive terminal: use `gh stack submit --auto --open`, then set each PR's title and body with `gh pr edit <number> --title "..." --body "..."`. `gh stack sync` never opens PRs; only `submit` does.

**Run the CI gates locally before pushing.** `pnpm run ci` (lint, format check, type check, tests, build; plain `pnpm ci` is pnpm's clean install, not this script) must pass before `gh stack submit`, `gh stack sync` or any `git push`.

Branch naming: `kebab-case` descriptive names (e.g. `stale-cache-fallback`, `add-weather-alerts`).

## Issue Tracker (wayfinder)

The issue tracker is local markdown under `.scratch/`. Do not search for it or query GitHub issues.

- **Active map**: `.scratch/media-dashboard/map.md`. When wayfinder is invoked with no argument, work through this map.
- **Tickets**: `.scratch/media-dashboard/issues/NN-kebab-title.md`, numbered in creation order. The title is the `#` heading.
- **Header lines** under the title: `Type: research|prototype|grilling|task`, then optionally `Blocked by: 05, 08` (ticket numbers), `Assignee: <name>` (the claim) and `Status: resolved` (closed).
- **Frontier**: tickets with no `Status` line, no `Assignee` line, and every `Blocked by` ticket resolved. Find it with one command: `grep -L "^Status: resolved" .scratch/media-dashboard/issues/*.md | xargs grep -H "^Blocked by\|^Assignee\|^Type"`.
- **Resolution**: add `Status: resolved`, write the answer under `## Answer` in the ticket, and add one line to the map's Decisions so far.
- Domain language is in `GLOSSARY.md`.

## Key Constraints

### TRMNL Display Constraints

- **Device**: TRMNL OG, firmware 1.8.18, "4 grays 2 bit" palette, Screenshot plugin pointed at the dashboard URL
- **Viewport**: 800 x 480 pixels (landscape), configured in `src/lib/config.ts`
- **Color depth**: 2-bit grayscale: `#000`, `#555`, `#aaa`, `#fff`
- **Render time**: Page must fully render within 5 seconds
- **Screen image**: under 90,000 bytes
- **Refresh interval**: 15 minutes (set on the TRMNL device)
- **URLs**: All CSS/JS/images/fonts must use absolute URLs
- No gradients, no lines thinner than 2px

### Vercel Hobby Plan Limits

- Cron jobs: 2 max, once per day each (we use GitHub Actions instead)
- Function timeout: 60 seconds
- Bandwidth: 100 GB/month
- Invocations: 1 million/month

### Free Tier API Limits

- **Steam**: 100,000 requests/day
- **OpenXBL**: 150 requests/hour
- **PSN**: Rate limited (use caching aggressively)
- **Nintendo**: unofficial; data updates once a day, fetch at most hourly
- **IGDB**: 4 requests/second
- **TMDB**: about 40 requests/second; attribution required
- **Letterboxd**: public RSS feed, no key; fetch at most hourly
- **Goodreads**: unofficial, no login, read only by the Collector from the home connection; every 6 hours, book lookups one at a time
- **Trakt**: client id only, no OAuth; 500 requests per 5 minutes; user endpoints are cached by Trakt for up to an hour, fetch at most hourly

## Code Style Guidelines

### TypeScript

```typescript
// Use explicit return types
async function getGamingData(): Promise<GamingData> {}

// Use interface over type for objects
interface RecentGame {
	gameId: string;
	title: string;
}

// Use const assertions for constants
const GAMING_PLATFORMS = ["steam", "xbox", "playstation"] as const;
type GamingPlatform = (typeof GAMING_PLATFORMS)[number];
```

### File Organization

```text
collector/                       # The Collector: runs on the home server, started by launchd
├── cli.ts                       # `collector tick|publish|restore|test-alert|run <job>`
├── tick.ts                      # runTick(): heartbeat, Vercel refresh check, due jobs, Alerts
├── jobs.ts                      # Job, everyHours(), dailyAt(), the jobs table
├── checks.ts                    # homeChecks(): what the Collector alerts on
├── alert-store.ts               # Alert state in SQLite, copied to Redis under `alert:`
├── token.ts                     # The Claude Code token's fingerprint and expiry day
├── code-update.ts, snapshot.ts  # The daily pull of main; the nightly snapshot and restore
├── goodreads/                   # parse.ts (widget, progress list, tooltip), read.ts (the job,
│                                # homeBooks()), markup.ts (Goodreads' markup rebuilt for tests)
├── db.ts, redis.ts              # The SQLite schema; the little of Redis the Collector uses
└── setup.sh                     # The owner's one-sitting setup wizard for the home server
src/
├── app/
│   ├── (dashboard)/             # TRMNL-facing routes (/, /preview)
│   ├── (admin)/admin/           # Admin UI (login, manual refresh, source health page)
│   └── api/
│       ├── health/              # Redis health check
│       ├── refresh/             # Cron-triggered data refresh
│       └── admin/               # Protected admin endpoints (login, refresh, test-alert)
├── components/
│   ├── screen/                  # The 800x480 screen: Screen, Spotlight, MediumCard,
│   │                            # Stars, PosterImage
│   ├── status/                  # Below the captured area: StatusStrip, TmdbAttribution,
│   │                            # TraktAttribution, IgdbAttribution
│   ├── admin/                   # AdminNav, PostButton (RefreshButton, TestAlertButton),
│   │                            # StateMark and TroubleNotes, HomeServer
│   └── ui/TrmnlFontFaces.tsx    # @font-face rules with absolute URLs
├── lib/
│   ├── api/                     # Source clients
│   │   ├── steam.ts, xbox.ts, playstation.ts, switch.ts   # Game sources
│   │   ├── igdb.ts              # IGDB, the Catalog for games
│   │   ├── gaming.ts            # Reads the sources, merges, adds Catalog data and posters
│   │   ├── letterboxd.ts        # The owner's Letterboxd diary feed, the Source for movies
│   │   ├── tmdb.ts              # TMDB, the Catalog for movies and shows
│   │   ├── movies.ts            # Reads the diary, adds Catalog data and posters
│   │   ├── trakt.ts             # The owner's Trakt history and watched shows, the Source for shows
│   │   ├── shows.ts             # Reads Trakt, applies the show rules, adds Catalog data and posters
│   │   ├── books.ts             # Reads the books the Collector published, adds posters
│   │   └── refresh.ts           # Refresh orchestrator
│   ├── cache/redis.ts           # Upstash Redis wrapper, TTLs, cache keys
│   ├── alerts/                  # The Alert rules and the Telegram sender. Imports nothing
│   │   │                        # from the rest of src/, so the Collector can share it
│   │   ├── alerts.ts            # processChecks(): start, 24-hour reminder, recovery, retry
│   │   └── telegram.ts          # sendTelegramMessage()
│   ├── health/                  # The refresh's bookkeeping and what Vercel alerts on
│   │   ├── sources.ts           # The sources and Catalogs, their names and tokens
│   │   ├── reads.ts             # trackRead(): notes each real read during a refresh
│   │   ├── status.ts            # updateStatus(), isStale(), the `refresh:status` key
│   │   ├── checks.ts            # healthChecks(): the Alert thresholds, token expiry days
│   │   ├── home.ts              # readHomeStatus(), isHeartbeatStale(): the home server as Vercel sees it
│   │   ├── alert.ts             # sendAlerts(), sendTestAlert(), the Redis Alert store
│   │   ├── strip.ts             # What the status strip shows (public)
│   │   └── report.ts            # healthReport(): what the admin area shows (not public)
│   ├── home/status.ts           # What the Collector publishes of itself: the `home:` keys, HomeStatus,
│   │                            # the job names. Imports nothing, shared by both sides
│   ├── screen/                  # What the screen shows
│   │   ├── types.ts             # Medium, Mode, SpotlightCandidate, MediumContent, ScreenView
│   │   ├── spotlight.ts         # pickSpotlight(): Mode shares, freshness, no repeats
│   │   ├── games.ts             # What games contribute: candidates and the Medium card
│   │   ├── movies.ts            # What movies contribute: Finished candidates and the Medium card
│   │   ├── shows.ts             # What shows contribute: In progress and Finished candidates and the Medium card
│   │   ├── books.ts             # What books contribute: In progress and Finished candidates and the Medium card
│   │   ├── format.ts            # "3 hours ago", "yesterday", "42 hours"
│   │   └── load.ts              # loadScreen(): read Redis, pick the Spotlight, read posters
│   ├── games/titles.ts          # Name cleaning; one Title per game across Platforms
│   ├── movies/diary.ts          # Days since a movie was watched, in the owner's time zone
│   ├── shows/progress.ts        # The show rules: one entry per show, Finished, Caught up
│   ├── books/shelf.ts           # The book rules: a book's activity day, eligibility, the latest book
│   ├── html.ts                  # decodeEntities()
│   ├── owner-day.ts             # Calendar days in the owner's time zone
│   ├── poster/                  # Dithers artwork to four-grey PNGs at refresh time
│   │   ├── render.ts            # The recipe: resize, normalise, lift, dither
│   │   ├── png.ts               # 2-bit palette PNG encoder
│   │   └── poster.ts            # getPoster(): fetch, render, keep in Redis
│   ├── base-url.ts              # The dashboard's own origin, for absolute URLs
│   ├── config.ts                # TRMNL screen config, the owner's time zone
│   └── env.ts                   # Environment variable validation groups
├── types/                       # TypeScript type definitions
└── proxy.ts                     # Auth for /admin and /api/admin routes
```

### Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

## Architecture

### Data Flow

The dashboard is **cache-first**. The page never calls a source or Catalog while rendering.

```
GitHub Actions (every 15 min)
  → POST /api/refresh (with CRON_SECRET)
    → refreshAllData() fetches every source
      → Games: Steam, Xbox, PSN and Switch plays merged into one Title per game
      → Movies: the diary entries in the owner's Letterboxd feed
      → Shows: the latest episode watched of each show in the owner's Trakt history, with where the owner is in its season
      → TMDB adds the director, year, overview, rating and poster for recently watched movies, and the overview, rating and poster for recently watched shows
      → IGDB adds the description, rating and cover for recently played Titles
      → Books: whatever the Collector last published as `home:books`; no source is read
      → Posters are dithered and stored
    → Stores the combined result in Redis (TTL'd + non-expiring fallback)
    → Writes its bookkeeping: its last-success time and each source's health
    → Sends the Telegram Alerts the bookkeeping calls for, and one when the home server's heartbeat is Stale

Collector tick (launchd on the home server, every 15 min)
  → runTick()
    → Writes the heartbeat and `home:status`
    → Calls POST /api/refresh itself when the last success is over 30 minutes old
    → Runs the jobs that are due according to SQLite
      → Goodreads read (every 6 hours): both shelves and the progress list into SQLite
      → Snapshot (nightly), code update (daily at 03:30 Sydney, last in the tick)
    → Publishes `home:status` and `home:books` from SQLite
    → Sends its own Alerts, with the sender [home]

Dashboard page render (server-side)
  → loadScreen()
    → Reads from Redis (TTL'd key, falls back to the :latest key)
    → Each Medium contributes its Spotlight candidates and its latest activity
    → pickSpotlight() picks a Title; the pick is kept in Redis so it is not repeated
    → Reads the stored poster and thumbnails
    → Renders the 800x480 screen: Spotlight poster, text column, rail of Medium cards
  → loadStatusStrip() reads the bookkeeping for the status strip below the screen
```

### Caching Strategy

Each `cacheSet` writes two Redis keys: a TTL'd key for freshness and a non-expiring `:latest` key as fallback, so data is stale but never missing.

- Each game source's plays (`plays:<source>`): 1-hour TTL
- The Letterboxd diary (`diary:letterboxd`): 1-hour TTL
- Trakt activity, the latest watched episodes and the watched episodes of those shows (`watched:trakt`): 1-hour TTL
- A show's seasons and next episode (`trakt:show:<Trakt id>`): reused for 1 day, and read again sooner when the owner has watched more of the season than Trakt counts as aired; the last good copy is kept 30 days for when Trakt fails
- IGDB lookups (`igdb:game:<title id>`): 30 days for a match, 1 day for a miss
- TMDB lookups (`tmdb:movie:<TMDB id>`, `tmdb:show:<TMDB id>`): 30 days for a match, 1 day for a miss
- Twitch app token (`igdb:token`): until a day before it expires
- Combined dashboard data: 15-minute TTL; while it holds movies or shows its `:latest` copy expires 150 days after they were read (see TMDB below)
- PSN refresh token: `psn:auth`, no TTL
- Posters: `poster:v<recipe version>:<target>:<hash of source URL>`, no TTL, except posters made from TMDB artwork, which expire after 150 days (bump `RECIPE_VERSION` in `poster.ts` when the recipe's output changes)
- The previous Spotlight pick: `spotlight:previous`, no TTL
- The refresh's bookkeeping: `refresh:status`, no TTL
- Alert state: `alert:<failure>` (such as `alert:vercel:psn`), one key per failure, deleted when it clears. `alert:` is the one prefix the Collector also writes under
- The last Alert Vercel tried to send: `telegram:last-send`, no TTL
- The Collector's keys, none with a TTL: `home:status` (heartbeat, commit, jobs, Claude Code token expiry; rewritten every tick), `home:books` (the currently-reading shelf and the latest 20 read) and `home:backup` (the newest snapshot of the Collector's SQLite, gzipped)

**TMDB's terms**: its data may not be kept longer than 6 months. A lookup is reused for 30 days and anything made from it (a poster, the dashboard data's `:latest` copy) expires 150 days after it is written (`CACHE_TTL.TMDB_LOOKUP`, `CACHE_TTL.TMDB_DERIVED`). The attribution notice and logo (`TmdbAttribution`) are on the status strip, below the 800x480 area the device captures. TMDB data is never given to an LLM.

**Trakt's API policy** asks for an attribution line; `TraktAttribution` sits below the TMDB notice, with the IGDB line after it.

### Bookkeeping and Alerts

Every real read of a source or Catalog (not an answer from our own cache) goes through `trackRead()`. After a refresh, `updateStatus()` stores per source the last good read, the failed runs in a row and whether its token was rejected. A run fails for a source when it tried to read it and no read worked; a run that did not need to read a source leaves it alone. A source throws `TokenRejectedError` when its token is turned away.

- A Source is Stale when its last good read is more than 2 hours old. A Catalog is read only on demand, so it is Stale only while its reads are failing.
- `healthChecks()` holds the thresholds: a read alerts after 4 failed runs in a row, a rejected token (PSN, Nintendo, Trakt) at once, and a dated token 14 and 3 days before it expires. PSN's expiry is 60 days after the day its fingerprint changed; Nintendo's date is a constant in `checks.ts`.
- `processChecks()` sends one message when a failure starts, a reminder every 24 hours and one line when it clears. A message Telegram does not take is retried on the next run.
- When Redis cannot be reached the refresh sends one "Redis unreachable" message and fails.
- Vercel alerts when the home server's heartbeat (`home:status`) is more than 1 hour old; before the Collector has ever ticked there is nothing to alert on.
- The Collector's Alerts (`collector/checks.ts`) follow the same rules through `processChecks()`: the Goodreads read after 2 failed reads in a row, a failed code update at once, the Vercel refresh Stale after 1 hour unless the tick's own call to the refresh works, Redis unreachable, and the Claude Code token 14 and 3 days before it expires (one year after its fingerprint was first seen or changed). Its Alert state lives in SQLite, so it still alerts when Redis is down.
- The status strip and the source health page also show the home server's heartbeat, the Collector's jobs and the Claude Code token's expiry.
- The admin area looks like the device: the panel's four greys on white, with `--color-signal` kept for trouble. Text is Geist Pixel (the `geist` package), drawn for ordinary screens; the wordmark and headings stay in the TRMNL face (`.admin` and `type-42` in `globals.css`). Its overview (`/admin`) leads with `healthReport()`'s headline and shows the screen.
- The status strip is public: times and source names only. Error text and tokens are on the source health page (`/admin/sources`), which also has the test Alert button.

### The screen

The layout, type, Modes and Spotlight rotation rules are in the spec overview. A Medium joins the screen by providing a `MediumContent` (see `src/lib/screen/games.ts`, `movies.ts` and `shows.ts`) and adding it to `loadScreen()`. A Medium whose stage has not shipped shows an empty Medium card.

Type utilities are in `globals.css`: `type-12`, `type-16`, `type-21` (the TRMNL pixel fonts, only at their native sizes, unsmoothed) and `type-title` (Inter Bold, the Spotlight title only).

### Posters

Artwork is dithered by us when data is refreshed, never at render time and never by TRMNL (`src/lib/poster/`). The four-grey PNG is stored in Redis and embedded in the page as a data URI, shown 1:1 with `image-rendering: pixelated`. `next/image` is not used. The recipe is in the spec overview.

### Tests

Vitest, with test files beside the code (`*.test.ts`), in `src/` and `collector/`. Tests go through a module's public interface.

### The Collector

- Run by `tsx`, so it imports from `src/` with the `@/` alias. Keep what it imports free of Next.js.
- **Key ownership**: every key the Collector writes starts with `home:`, and Vercel never writes under it. The one shared prefix is `alert:` (per-failure Alert state), written by both.
- **SQLite is its record** (`~/trmnl-collector/collector.db`); Redis can be rebuilt from it with `collector publish`. Jobs write SQLite only; the tick publishes.
- **Goodreads** gives no finish date: a book is Finished on the day its review id is first seen on the read shelf, and the first read records every book already there with no date. A read fails, changing nothing, when a request errors, a page is not what was asked for, or the read shelf had books and now has none. Goodreads does not say which time zone its progress times are in, so books use days, never hours.
- The home server's files are in `~/trmnl-collector/` (`.env`, `collector.db`, `snapshots/`, `logs/`, the `collector` wrapper), set up by `collector/setup.sh`. Agents do not run the wizard or change the home server; the owner does.

### Auth

- Admin routes protected by the proxy (`src/proxy.ts`)
- Supports Bearer token (header) and cookie-based auth
- Uses `CRON_SECRET` as the admin password
- Browser requests without auth redirect to `/admin/login`

## GitHub Actions Workflows

### Automation (require `VERCEL_URL` and `CRON_SECRET` repo secrets)

| Workflow      | Schedule     | Purpose                              |
| ------------- | ------------ | ------------------------------------ |
| `refresh.yml` | Every 15 min | Main data refresh via `/api/refresh` |

### CI

| Workflow         | Trigger | Purpose                    |
| ---------------- | ------- | -------------------------- |
| `oxfmt.yml`      | Push/PR | Oxfmt formatter check      |
| `oxlint.yml`     | Push/PR | Oxlint linter              |
| `type-check.yml` | Push/PR | TypeScript type checking   |
| `test.yml`       | Push/PR | Vitest suite               |
| `build.yml`      | Push/PR | Next.js build verification |

### GitHub Actions Secrets Required

- `VERCEL_URL`: Dashboard hostname (e.g. `trmnl.yuyanli.dev`, no `https://`)
- `CRON_SECRET`: Must match the `CRON_SECRET` env var in Vercel

## Environment Variables

```
# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Auth / Cron
CRON_SECRET=

# Steam
STEAM_API_KEY=
STEAM_ID=

# Xbox (OpenXBL)
OPENXBL_API_KEY=

# PlayStation
PSN_NPSSO=                    # Manual: expires every ~2 months

# Nintendo Switch
NINTENDO_SESSION_TOKEN=       # Manual: expires 2028-11-16

# Letterboxd
LETTERBOXD_USERNAME=          # The owner's public profile name

# Trakt
TRAKT_CLIENT_ID=              # The client id of a Trakt API app; no OAuth
TRAKT_USER_SLUG=              # The owner's public profile name

# TMDB
TMDB_API_KEY=                 # The API key or the API read access token

# IGDB (through a Twitch application)
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

# Telegram (Alerts)
TELEGRAM_BOT_TOKEN=           # From BotFather
TELEGRAM_CHAT_ID=             # The owner's private chat with the bot

# Client-side
NEXT_PUBLIC_APP_URL=
```

The Collector reads `~/trmnl-collector/.env` on the home server, not Vercel's variables: the Upstash and Telegram values above, `CRON_SECRET`, `DASHBOARD_URL` (the dashboard's origin, with `https://`), `GOODREADS_USER_ID` (the number in the owner's profile address) and `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`, used from stage 8). No `ANTHROPIC_API_KEY` may be set there.

Env var validation is centralized in `src/lib/env.ts` with grouped checks. `.env.local` is blocked to agents by a deny rule: the owner adds every secret by hand, locally and in Vercel.

## Commands

```bash
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # Run Oxlint
pnpm format           # Run Oxfmt check
pnpm fix              # Run Oxfmt and write changes
pnpm type-check       # TypeScript type check
pnpm test             # Run the Vitest suite (src/**/*.test.ts)
pnpm run ci           # Full CI pipeline (lint + format + type-check + test + build)
pnpm collector        # The Collector's CLI (on the home server: ~/trmnl-collector/collector)
pnpm clean            # Remove .next and node_modules
```

## Common Issues

### Dashboard Shows No Data

1. **GitHub Actions disabled**: GitHub disables cron workflows after 60 days of repo inactivity. Check the Actions tab and re-enable.
2. **`VERCEL_URL` secret missing**: the refresh workflow needs this repo secret set to the dashboard hostname.
3. **Redis expired**: if cron hasn't run, TTL'd keys expire. The `:latest` fallback keys should prevent total data loss. Trigger a manual refresh from admin.

### PSN Token Expired

PSN NPSSO expires every ~2 months. To refresh:

1. Visit <https://www.playstation.com/> and sign in
2. Visit <https://ca.account.sony.com/api/v1/ssocookie>
3. Copy the npsso value
4. Update `PSN_NPSSO` in Vercel environment variables
5. Redeploy or wait for next refresh cycle

## Manual Breakpoints

These require manual action and cannot be automated:

1. **Account Registration**: Upstash, Steam, OpenXBL, a Twitch application (for IGDB), TMDB, a Trakt API app, a Telegram bot from BotFather
2. **Token Retrieval**: PSN NPSSO and the Nintendo session token (manual browser login required)
3. **Environment Variables**: Must be added to the Vercel dashboard
4. **GitHub Secrets**: `VERCEL_URL` and `CRON_SECRET` must be set as repo secrets
5. **The home server**: the owner runs `collector/setup.sh` there (Node, the clone, `~/trmnl-collector/.env`, the Claude Code token, the launchd job)
