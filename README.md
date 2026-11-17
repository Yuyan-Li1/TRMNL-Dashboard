# TRMNL Dashboard

A personal dashboard for a [TRMNL](https://trmnl.com) e-ink display: an 800x480 page in four greys, rendered by Next.js on Vercel and captured by the device every 15 minutes.

## Status

The dashboard is being rebuilt.

- **Today** it is a schedule-aware display: weather, Sydney train times, calendar, routines and recent games, chosen by day type (office, work from home, weekend) and time of day.
- **It is becoming** a media-only display of what the owner is playing, watching and reading: one large Spotlight with artwork, and a small card for each other medium (game, movie, show, book).

The rebuild is fully specified in [`docs/spec/media-dashboard/`](./docs/spec/media-dashboard/README.md) and is delivered in eight stages, each leaving a working device:

| #   | Stage                                                                                              | What the device gains                               |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | [New screen with games](./docs/spec/media-dashboard/01-new-screen-with-games.md)                   | The new screen; games from Steam, Xbox, PSN, Switch |
| 2   | [Movies](./docs/spec/media-dashboard/02-movies.md)                                                 | Movies from Letterboxd                              |
| 3   | [Shows](./docs/spec/media-dashboard/03-shows.md)                                                   | Shows from Trakt                                    |
| 4   | [Alerts and status strip](./docs/spec/media-dashboard/04-alerts-and-status-strip.md)               | Telegram alerts when a source breaks                |
| 5   | [Collector and books](./docs/spec/media-dashboard/05-collector-and-books.md)                       | Books from Goodreads, read by a home server         |
| 6   | [Consumed set and Catalog picks](./docs/spec/media-dashboard/06-consumed-set-and-catalog-picks.md) | Recommendations from TMDB and IGDB                  |
| 7   | [Friend activity](./docs/spec/media-dashboard/07-friend-activity.md)                               | Friends' Letterboxd ratings and reviews             |
| 8   | [LLM picks](./docs/spec/media-dashboard/08-llm-picks.md)                                           | Recommendations written against the owner's taste   |

No stage has shipped yet. The `docs/00` to `docs/09` files are the original build plan for today's dashboard and are removed in stage 1.

## How it works

```text
GitHub Actions (every 15 min)
  → POST /api/refresh
    → fetches every source in parallel
    → writes the result to Redis (a TTL'd key plus a non-expiring fallback)

TRMNL device (every 15 min)
  → screenshots the dashboard page
    → the page reads only from Redis, never from a source
```

The page is cache-first, so a failing source leaves stale data on screen instead of a blank panel.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- Upstash Redis for the cache; MongoDB Atlas for schedules and routines (removed in stage 1)
- Vercel Hobby for hosting, GitHub Actions for the 15-minute refresh
- oxfmt for formatting, Oxlint for linting
- pnpm

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

- Dashboard: <http://localhost:3000>
- Admin: <http://localhost:3000/admin> (the password is `CRON_SECRET`)

The environment variables, the accounts they come from and the common failures are documented in [`CLAUDE.md`](./CLAUDE.md).

## Commands

```bash
pnpm dev          # development server
pnpm build        # production build
pnpm lint         # Oxlint
pnpm format       # oxfmt, check only
pnpm fix          # oxfmt, write changes
pnpm type-check   # TypeScript
pnpm ci           # lint, format, type-check and build
```

## Documentation

- [`docs/spec/media-dashboard/`](./docs/spec/media-dashboard/README.md): the staged spec for the rebuild
- [`GLOSSARY.md`](./GLOSSARY.md): the domain terms the spec uses
- [`CLAUDE.md`](./CLAUDE.md): architecture, constraints, environment variables and workflow for the current code
- `.scratch/media-dashboard/`: the decision tickets behind the spec
