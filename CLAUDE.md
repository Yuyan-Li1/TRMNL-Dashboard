# CLAUDE.md - AI Agent Instructions

## Project Overview

A TRMNL e-ink dashboard that shows one person's media activity: what they are playing, watching and reading, on one 800x480 four-grey screen. Built with Next.js and TypeScript, hosted on Vercel (Hobby plan).

The dashboard is being rebuilt in stages. The staged spec is `docs/spec/media-dashboard/` (start with its `README.md`); it holds every product and source decision. Domain language is in `GLOSSARY.md`. Stages 1 (games), 2 (movies) and 3 (shows) are built; books arrive in a later stage.

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm (required)
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **React**: 19 (with React Compiler enabled)
- **Store**: Upstash Redis, the only store Vercel reads
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
src/
├── app/
│   ├── (dashboard)/             # TRMNL-facing routes (/, /preview)
│   ├── (admin)/admin/           # Admin UI (login, manual refresh)
│   └── api/
│       ├── health/              # Redis health check
│       ├── refresh/             # Cron-triggered data refresh
│       ├── tokens/              # Live PSN token check
│       └── admin/               # Protected admin endpoints (login, refresh)
├── components/
│   ├── screen/                  # The 800x480 screen: Screen, Spotlight, MediumCard,
│   │                            # Stars, PosterImage, TmdbAttribution
│   ├── admin/                   # RefreshButton
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
│   │   └── refresh.ts           # Refresh orchestrator
│   ├── cache/redis.ts           # Upstash Redis wrapper, TTLs, cache keys
│   ├── screen/                  # What the screen shows
│   │   ├── types.ts             # Medium, Mode, SpotlightCandidate, MediumContent, ScreenView
│   │   ├── spotlight.ts         # pickSpotlight(): Mode shares, freshness, no repeats
│   │   ├── games.ts             # What games contribute: candidates and the Medium card
│   │   ├── movies.ts            # What movies contribute: Finished candidates and the Medium card
│   │   ├── shows.ts             # What shows contribute: In progress and Finished candidates and the Medium card
│   │   ├── format.ts            # "3 hours ago", "yesterday", "42 hours"
│   │   └── load.ts              # loadScreen(): read Redis, pick the Spotlight, read posters
│   ├── games/titles.ts          # Name cleaning; one Title per game across Platforms
│   ├── movies/diary.ts          # Days since a movie was watched, in the owner's time zone
│   ├── shows/progress.ts        # The show rules: one entry per show, Finished, Caught up
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
      → Posters are dithered and stored
    → Stores the combined result in Redis (TTL'd + non-expiring fallback)

Dashboard page render (server-side)
  → loadScreen()
    → Reads from Redis (TTL'd key, falls back to the :latest key)
    → Each Medium contributes its Spotlight candidates and its latest activity
    → pickSpotlight() picks a Title; the pick is kept in Redis so it is not repeated
    → Reads the stored poster and thumbnails
    → Renders the 800x480 screen: Spotlight poster, text column, rail of Medium cards
```

### Caching Strategy

Each `cacheSet` writes two Redis keys: a TTL'd key for freshness and a non-expiring `:latest` key as fallback, so data is stale but never missing.

- Each game source's plays (`plays:<source>`): 1-hour TTL
- The Letterboxd diary (`diary:letterboxd`): 1-hour TTL
- Trakt activity, the latest watched episodes and the watched episodes of those shows (`watched:trakt`): 1-hour TTL
- A show's seasons and next episode (`trakt:show:<Trakt id>`): 1 day, and read again sooner once the owner has watched an episode since
- IGDB lookups (`igdb:game:<title id>`): 30 days for a match, 1 day for a miss
- TMDB lookups (`tmdb:movie:<TMDB id>`, `tmdb:show:<TMDB id>`): 30 days for a match, 1 day for a miss
- Twitch app token (`igdb:token`): until a day before it expires
- Combined dashboard data: 15-minute TTL; while it holds movies or shows its `:latest` copy expires 150 days after they were read (see TMDB below)
- PSN refresh token: `psn:auth`, no TTL
- Posters: `poster:v<recipe version>:<target>:<hash of source URL>`, no TTL, except posters made from TMDB artwork, which expire after 150 days (bump `RECIPE_VERSION` in `poster.ts` when the recipe's output changes)
- The previous Spotlight pick: `spotlight:previous`, no TTL

**TMDB's terms**: its data may not be kept longer than 6 months. A lookup is reused for 30 days and anything made from it (a poster, the dashboard data's `:latest` copy) expires 150 days after it is written (`CACHE_TTL.TMDB_LOOKUP`, `CACHE_TTL.TMDB_DERIVED`). The attribution notice and logo (`TmdbAttribution`) are on the dashboard page below the 800x480 area the device captures. TMDB data is never given to an LLM.

### The screen

The layout, type, Modes and Spotlight rotation rules are in the spec overview. A Medium joins the screen by providing a `MediumContent` (see `src/lib/screen/games.ts`, `movies.ts` and `shows.ts`) and adding it to `loadScreen()`. A Medium whose stage has not shipped shows an empty Medium card.

Type utilities are in `globals.css`: `type-12`, `type-16`, `type-21` (the TRMNL pixel fonts, only at their native sizes, unsmoothed) and `type-title` (Inter Bold, the Spotlight title only).

### Posters

Artwork is dithered by us when data is refreshed, never at render time and never by TRMNL (`src/lib/poster/`). The four-grey PNG is stored in Redis and embedded in the page as a data URI, shown 1:1 with `image-rendering: pixelated`. `next/image` is not used. The recipe is in the spec overview.

### Tests

Vitest, with test files beside the code (`*.test.ts`). Tests go through a module's public interface.

Key ownership (from stage 5): every key the Collector writes starts with `home:`. Vercel never writes under it.

### Auth

- Admin routes protected by the proxy (`src/proxy.ts`)
- Supports Bearer token (header) and cookie-based auth
- Uses `CRON_SECRET` as the admin password
- Browser requests without auth redirect to `/admin/login`

## GitHub Actions Workflows

### Automation (require `VERCEL_URL` and `CRON_SECRET` repo secrets)

| Workflow           | Schedule       | Purpose                                                      |
| ------------------ | -------------- | ------------------------------------------------------------ |
| `refresh.yml`      | Every 15 min   | Main data refresh via `/api/refresh`                         |
| `health-check.yml` | Every 6 hours  | Check Redis connectivity, creates GitHub issue on failure    |
| `token-expiry.yml` | Daily 9 AM UTC | Check the PSN token, creates GitHub issue when it is expired |

The two issue workflows are replaced by Telegram Alerts in stage 4.

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

# Client-side
NEXT_PUBLIC_APP_URL=
```

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

1. **Account Registration**: Upstash, Steam, OpenXBL, a Twitch application (for IGDB), TMDB, a Trakt API app
2. **Token Retrieval**: PSN NPSSO and the Nintendo session token (manual browser login required)
3. **Environment Variables**: Must be added to the Vercel dashboard
4. **GitHub Secrets**: `VERCEL_URL` and `CRON_SECRET` must be set as repo secrets
