# CLAUDE.md - AI Agent Instructions

## Project Overview

This is a custom TRMNL e-ink dashboard built with Next.js, TypeScript, and hosted on Vercel (Hobby plan). The dashboard displays different content based on day type (office/WFH/weekend) and time of day. Location is Sydney, Australia.

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm (required)
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **React**: 19 (with React Compiler enabled)
- **Database**: MongoDB Atlas (free tier, via Mongoose)
- **Cache**: Upstash Redis
- **Styling**: Tailwind CSS 4 (e-ink optimized)
- **Formatter**: Biome
- **Linter**: Oxlint
- **Deployment**: Vercel Hobby plan
- **Scheduling**: GitHub Actions (workaround for Vercel cron limits)

## Git Workflow (Git Town)

This project uses [Git Town](https://www.git-town.com/) for branch management.

```bash
# Create a feature branch (from main)
git town hack <branch-name>

# Stage, commit, then push + open PR
git town propose --title "PR title" --body "PR body"

# Sync branch with main
git town sync

# Clean up merged branches
git town prune-branches
```

Branch naming: `kebab-case` descriptive names (e.g. `stale-cache-fallback`, `add-weather-alerts`).

## Key Constraints

### TRMNL Display Constraints

- **Viewport**: 800 x 480 pixels (landscape), configured in `src/lib/config.ts`
- **Color depth**: 2-bit grayscale (black, white, light gray, dark gray)
- **Render time**: Page must fully render within 5 seconds
- **Refresh interval**: 30 minutes (with 30-minute buffer)
- **URLs**: All CSS/JS/images must use absolute URLs
- No gradients, no thin lines under 2px, no anti-aliased graphics

### Vercel Hobby Plan Limits

- Cron jobs: 2 max, once per day each (we use GitHub Actions instead)
- Function timeout: 60 seconds
- Bandwidth: 100 GB/month
- Invocations: 1 million/month

### Free Tier API Limits

- **Open-Meteo**: 10,000 requests/day (no auth required)
- **Transport NSW**: 60,000 requests/day
- **Steam**: 100,000 requests/day
- **OpenXBL**: 150 requests/hour
- **PSN**: Rate limited (use caching aggressively)
- **Google Calendar**: Essentially unlimited for personal use

## Code Style Guidelines

### TypeScript

```typescript
// Use explicit return types
async function getWeather(): Promise<WeatherData> { }

// Use interface over type for objects
interface WidgetConfig {
  id: string;
  type: WidgetType;
  priority: number;
}

// Use const assertions for constants
const DAY_TYPES = ['office', 'wfh', 'weekend'] as const;
type DayType = typeof DAY_TYPES[number];
```

### File Organization

```text
src/
├── app/
│   ├── (dashboard)/             # TRMNL-facing routes (/, /preview)
│   ├── (admin)/admin/           # Admin UI (schedules, routines, tokens, login)
│   └── api/                     # API routes
│       ├── health/              # Health check
│       ├── schedule/            # Schedule context
│       ├── refresh/             # Cron-triggered data refresh
│       ├── tokens/              # Token health status
│       └── admin/               # Protected admin endpoints
│           ├── login/
│           ├── refresh/
│           ├── schedules/[id]/
│           └── routines/[id]/
├── components/
│   ├── widgets/                 # WeatherWidget, TransitWidget, CalendarWidget,
│   │                            # GamingWidget, RoutineWidget, MedicationWidget,
│   │                            # AlertBanner
│   ├── admin/                   # ScheduleEditor, RefreshButton
│   └── ui/                      # EinkCard, EinkGrid, EinkIcon
├── lib/
│   ├── api/                     # External API clients
│   │   ├── weather.ts           # Open-Meteo
│   │   ├── transport.ts         # Transport NSW (Trip Planner API)
│   │   ├── calendar.ts          # Google Calendar
│   │   ├── steam.ts             # Steam API
│   │   ├── xbox.ts              # OpenXBL
│   │   ├── playstation.ts       # PSN (NPSSO token)
│   │   ├── gaming.ts            # Gaming aggregator (all platforms)
│   │   └── refresh.ts           # Refresh orchestrator
│   ├── cache/redis.ts           # Upstash Redis wrapper, TTLs, cache keys
│   ├── dashboard/
│   │   ├── loader.ts            # Load cached data for dashboard render
│   │   └── layout.ts            # Widget layout calculation (2x2 grid)
│   ├── db/
│   │   ├── mongodb.ts           # Connection setup
│   │   ├── seed.ts              # Database seeding (run via pnpm db:seed)
│   │   └── models/              # Schedule, Routine, Token schemas
│   ├── schedule/
│   │   ├── context.ts           # Current schedule context + special conditions
│   │   ├── timing.ts            # Time block calculations
│   │   └── widgets.ts           # Widget selection for context
│   ├── config.ts                # Location (Sydney), commute (Lidcombe→Bondi Jct), TRMNL config
│   ├── env.ts                   # Environment variable validation groups
│   └── utils/date.ts            # Date utilities
├── types/                       # TypeScript type definitions
│   ├── index.ts                 # Core types (DayType, TimeBlock, WidgetType)
│   ├── schedule.ts, weather.ts, calendar.ts, gaming.ts, transport.ts
└── middleware.ts                # Auth for /admin and /api/admin routes
```

### Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

## Architecture

### Data Flow

The dashboard uses a **cache-first architecture**. The dashboard page never fetches data directly from APIs.

```
GitHub Actions (every 15 min)
  → POST /api/refresh (with CRON_SECRET)
    → refreshAllData() fetches all APIs in parallel (Promise.allSettled)
    → Transit: uses Trip Planner API for commute journeys
      → Direction auto-detected: before 2 PM = to_work, after = to_home
      → Lidcombe → Bondi Junction (morning) / reverse (evening)
    → Stores combined result in Redis (TTL'd + non-expiring fallback)

Dashboard page render (server-side)
  → loadDashboardData()
    → Reads from Redis cache (TTL'd key, falls back to :latest key)
    → Determines schedule context (day type, time block)
    → Selects widgets for context
    → Renders 800x480 e-ink layout
```

### Caching Strategy

Each `cacheSet` writes two Redis keys: a TTL'd key for freshness and a non-expiring `:latest` key as fallback, so data is stale but never missing.

- Weather: 15-minute TTL
- Transit: 5-minute TTL
- Calendar: 10-minute TTL
- Gaming: 1-hour TTL
- Token health: 5-minute TTL
- Combined dashboard data: 15-minute TTL

### Schedule System

The schedule determines which widgets appear based on:

1. **Day type**: office, wfh, weekend
2. **Time block**: morning, workday, evening, night
3. **Special conditions**: rain (>30% precip), train delays/cancellations (>10 min delay or cancelled journeys, checked morning+evening on office days), meeting soon (<30 min), extreme temp (>35C or <10C)

### Widget System

Each widget:

1. Accepts data prop (can be `null`)
2. Shows graceful fallback if data is unavailable
3. Respects e-ink display constraints (high contrast, no animations)
4. Is selected and prioritized by the schedule system

### Auth

- Admin routes protected by middleware (`src/middleware.ts`)
- Supports Bearer token (header) and cookie-based auth
- Uses `CRON_SECRET` as the admin password
- Browser requests without auth redirect to `/admin/login`

## GitHub Actions Workflows

### Automation (require `VERCEL_URL` and `CRON_SECRET` repo secrets)

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `refresh.yml` | Every 15 min | Main data refresh via `/api/refresh` |
| `morning-prefetch.yml` | 7:40 AM Sydney (Mon-Fri) | Pre-cache morning data (runs twice with 30s gap) |
| `health-check.yml` | Every 6 hours | Check MongoDB/Redis connectivity, creates GitHub issue on failure |
| `token-expiry.yml` | Daily 9 AM UTC | Check token health, creates GitHub issue for expired tokens |

### CI

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `biome.yml` | Push/PR | Biome formatter check |
| `oxlint.yml` | Push/PR | Oxlint linter |
| `type-check.yml` | Push/PR | TypeScript type checking |
| `build.yml` | Push/PR | Next.js build verification |

### GitHub Actions Secrets Required

- `VERCEL_URL`: Dashboard hostname (e.g. `trmnl.yuyanli.dev`, no `https://`)
- `CRON_SECRET`: Must match the `CRON_SECRET` env var in Vercel

## Environment Variables

### Vercel Environment Variables

```
# Database & Cache
MONGODB_URI=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Auth / Cron
CRON_SECRET=

# Transport NSW
TFNSW_API_KEY=

# Steam
STEAM_API_KEY=
STEAM_ID=

# Xbox (OpenXBL)
OPENXBL_API_KEY=

# PlayStation
PSN_NPSSO=                    # Manual: expires every ~2 months

# Google Calendar
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=

# Client-side
NEXT_PUBLIC_APP_URL=
```

Env var validation is centralized in `src/lib/env.ts` with grouped checks.

## Commands

```bash
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # Run Oxlint
pnpm format           # Run Biome check
pnpm fix              # Run Biome auto-fix
pnpm type-check       # TypeScript type check
pnpm ci               # Full CI pipeline (lint + format + type-check + build)
pnpm db:seed          # Seed MongoDB with default schedules/routines
pnpm clean            # Remove .next and node_modules
```

## Common Issues

### Dashboard Shows No Data

1. **GitHub Actions disabled** — GitHub disables cron workflows after 60 days of repo inactivity. Check Actions tab and re-enable.
2. **`VERCEL_URL` secret missing** — The refresh workflow needs this repo secret set to the dashboard hostname.
3. **Redis expired** — If cron hasn't run, TTL'd keys expire. The `:latest` fallback keys should prevent total data loss. Trigger a manual refresh from admin.

### PSN Token Expired

PSN NPSSO expires every ~2 months. To refresh:

1. Visit <https://www.playstation.com/> and sign in
2. Visit <https://ca.account.sony.com/api/v1/ssocookie>
3. Copy the npsso value
4. Update `PSN_NPSSO` in Vercel environment variables
5. Redeploy or wait for next refresh cycle

### MongoDB Connection Issues

- Ensure IP whitelist includes `0.0.0.0/0` for Vercel serverless
- Check connection string format includes `retryWrites=true&w=majority`
- MongoDB Atlas free tier can pause after extended inactivity

### Transport NSW Issues

- **403 Errors**: API key may have expired; regenerate at opendata.transport.nsw.gov.au
- Ensure correct header format: `Authorization: apikey YOUR_KEY`
- **API used**: Trip Planner (`/v1/tp/trip`), not Departure Monitor. Returns commute journeys (Lidcombe ↔ Bondi Junction) with legs, durations, and realtime delays.
- **Stop IDs**: Lidcombe `10101331`, Town Hall `10101101`, Bondi Junction `10101109` (configured in `COMMUTE` constant in `src/lib/config.ts`)

## Manual Breakpoints

These require manual action and cannot be automated:

1. **Account Registration**: MongoDB Atlas, Upstash, Transport NSW, Steam, OpenXBL
2. **Token Retrieval**: PSN NPSSO (manual browser login required)
3. **Google Cloud Setup**: Service account creation and calendar sharing
4. **Environment Variables**: Must be added to Vercel dashboard
5. **GitHub Secrets**: `VERCEL_URL` and `CRON_SECRET` must be set as repo secrets
