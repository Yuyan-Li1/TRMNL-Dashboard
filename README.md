# TRMNL Custom Dashboard - Implementation Plan

A modular, schedule-aware e-ink dashboard for TRMNL displays built with Next.js 14, TypeScript, MongoDB, and Vercel.

## 🎯 Project Goal

Create a personal dashboard that displays context-aware information on a TRMNL e-ink display:

- **Office days**: Morning routine, weather, train delays (Lidcombe → Bondi Junction)
- **WFH days**: Medication reminders, calendar events
- **Weekends**: Gaming stats (PlayStation, Xbox, Steam)
- **All days**: Night skincare routine on rotating schedule

## 📋 Implementation Steps

| Step | File                                                              | Description                          | Manual Actions Required         |
| ---- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------------- |
| 0    | [00-project-setup.md](./docs/00-project-setup.md)                 | Initialize Next.js project with pnpm | None                            |
| 1    | [01-database-setup.md](./docs/01-database-setup.md)               | MongoDB Atlas + Upstash Redis setup  | ⚠️ Account creation, env vars   |
| 2    | [02-core-api-integrations.md](./docs/02-core-api-integrations.md) | Weather, Transit, Calendar APIs      | ⚠️ API key registration         |
| 3    | [03-gaming-integrations.md](./docs/03-gaming-integrations.md)     | Steam, Xbox, PlayStation APIs        | ⚠️ API keys, PSN token          |
| 4    | [04-schedule-system.md](./docs/04-schedule-system.md)             | Day type and time block logic        | None                            |
| 5    | [05-widget-system.md](./docs/05-widget-system.md)                 | E-ink optimized widget components    | None                            |
| 6    | [06-dashboard-renderer.md](./docs/06-dashboard-renderer.md)       | TRMNL-compatible page rendering      | None                            |
| 7    | [07-admin-ui.md](./docs/07-admin-ui.md)                           | Schedule and routine management UI   | None                            |
| 8    | [08-github-actions.md](./docs/08-github-actions.md)               | Scheduled data refresh               | ⚠️ GitHub secrets setup         |
| 9    | [09-deployment.md](./docs/09-deployment.md)                       | Vercel deployment and TRMNL config   | ⚠️ Vercel env vars, TRMNL setup |

## 🛠 Tech Stack

```text
┌─────────────────────────────────────────────────────────────┐
│                        TRMNL Device                         │
│                    (Screenshots webpage)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Vercel (Hobby)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Next.js 14 App                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │  Dashboard  │  │   Admin UI  │  │  API Routes │  │   │
│  │  │   (TRMNL)   │  │   (Web)     │  │  (Refresh)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│   MongoDB   │      │   Upstash   │      │  External APIs  │
│   Atlas     │      │    Redis    │      │                 │
│  (Config)   │      │   (Cache)   │      │  • Open-Meteo   │
│             │      │             │      │  • TfNSW        │
└─────────────┘      └─────────────┘      │  • Google Cal   │
                                          │  • Steam        │
                                          │  • OpenXBL      │
                                          │  • PSN          │
                                          └─────────────────┘
         ▲
         │
┌─────────────────┐
│  GitHub Actions │
│  (Cron trigger) │
│  Every 15 min   │
└─────────────────┘
```

## 🔑 Required Accounts & API Keys

### Free Account Registration Required

| Service       | URL                                     | What You Get         |
| ------------- | --------------------------------------- | -------------------- |
| MongoDB Atlas | <https://www.mongodb.com/cloud/atlas>   | Connection string    |
| Upstash       | <https://upstash.com>                   | Redis URL + Token    |
| Transport NSW | <https://opendata.transport.nsw.gov.au> | API key              |
| Steam         | <https://steamcommunity.com/dev/apikey> | API key              |
| OpenXBL       | <https://xbl.io>                        | API key              |
| Google Cloud  | <https://console.cloud.google.com>      | Service account JSON |

### Manual Token Retrieval

| Service   | Method                                                                          |
| --------- | ------------------------------------------------------------------------------- |
| PSN NPSSO | Login to PlayStation.com → Visit <https://ca.account.sony.com/api/v1/ssocookie> |

## 📁 Final Project Structure

```text
trmnl-dashboard/
├── .github/
│   └── workflows/
│       └── refresh.yml          # Cron job (every 15 min)
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx         # Main TRMNL page
│   │   │   └── layout.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # Admin dashboard
│   │   │   ├── schedules/
│   │   │   ├── routines/
│   │   │   └── tokens/          # Token health status
│   │   └── api/
│   │       ├── refresh/
│   │       │   └── route.ts     # GitHub Actions endpoint
│   │       ├── schedule/
│   │       │   └── route.ts
│   │       └── health/
│   │           └── route.ts     # Token health check
│   ├── components/
│   │   ├── widgets/
│   │   │   ├── WeatherWidget.tsx
│   │   │   ├── TransitWidget.tsx
│   │   │   ├── CalendarWidget.tsx
│   │   │   ├── GamingWidget.tsx
│   │   │   ├── RoutineWidget.tsx
│   │   │   └── MedicationWidget.tsx
│   │   ├── admin/
│   │   │   ├── ScheduleEditor.tsx
│   │   │   ├── RoutineEditor.tsx
│   │   │   └── TokenStatus.tsx
│   │   └── ui/
│   │       ├── EinkCard.tsx
│   │       ├── EinkIcon.tsx
│   │       └── EinkGrid.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   ├── weather.ts
│   │   │   ├── transport.ts
│   │   │   ├── calendar.ts
│   │   │   ├── steam.ts
│   │   │   ├── xbox.ts
│   │   │   └── playstation.ts
│   │   ├── db/
│   │   │   ├── mongodb.ts
│   │   │   ├── models/
│   │   │   │   ├── schedule.ts
│   │   │   │   ├── routine.ts
│   │   │   │   └── token.ts
│   │   │   └── queries/
│   │   ├── cache/
│   │   │   └── redis.ts
│   │   ├── schedule/
│   │   │   ├── context.ts       # Day type + time block
│   │   │   ├── widgets.ts       # Widget visibility rules
│   │   │   └── timing.ts        # Refresh interval buffer
│   │   └── utils/
│   │       ├── date.ts
│   │       └── format.ts
│   └── types/
│       ├── weather.ts
│       ├── transport.ts
│       ├── gaming.ts
│       ├── schedule.ts
│       └── widget.ts
├── public/
│   └── icons/                   # E-ink optimized SVG icons
├── CLAUDE.md
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

## ⏱ Estimated Timeline

| Phase          | Steps | Time Estimate   |
| -------------- | ----- | --------------- |
| Foundation     | 0-1   | 2-3 hours       |
| Core APIs      | 2-3   | 4-5 hours       |
| Dashboard      | 4-6   | 4-5 hours       |
| Admin & Polish | 7-9   | 3-4 hours       |
| **Total**      |       | **13-17 hours** |

## 🔄 Refresh Schedule Logic

The dashboard must account for TRMNL's refresh interval (recommended: 30 min for battery life). Content must appear **at least one interval before** it's needed:

```text
Example: Wake up at 7:50 AM, 30-min refresh interval

7:20 AM - Dashboard shows morning routine (buffer time)
7:50 AM - Next refresh still shows morning routine
8:20 AM - Transition to workday content
```

This is handled by the `timing.ts` module which calculates display windows with configurable buffer.

## 🎮 Gaming Stats Display Logic

On weekends (and optionally WFH evenings), show recently played games across all platforms:

1. Fetch recent games from each platform
2. Combine and sort by last played timestamp
3. Display top 3-5 games with platform icon, title, and playtime
4. Show trophy/achievement progress if available

## 🚨 Token Health Monitoring

The admin UI includes a token health page showing:

- **PSN**: Token expiration estimate, "Refresh needed" warning
- **Xbox**: API key status
- **Steam**: API key status
- **Google**: Service account status
- **Transport NSW**: API key status

PSN tokens are tracked in MongoDB with:

```typescript
interface TokenHealth {
	service: "psn" | "xbox" | "steam" | "google" | "tfnsw";
	status: "healthy" | "expiring_soon" | "expired" | "error";
	lastChecked: Date;
	expiresAt?: Date; // For PSN access/refresh tokens
	errorMessage?: string;
}
```

## 🚀 Quick Start (After Implementation)

```bash
# Clone and install
git clone <your-repo>
cd trmnl-dashboard
pnpm install

# Copy environment template
cp .env.example .env.local

# Fill in your API keys (see step 1-3 docs)

# Run development server
pnpm dev

# Open http://localhost:3000 for dashboard
# Open http://localhost:3000/admin for admin UI
```

## 📖 Documentation Index

- [CLAUDE.md](./CLAUDE.md) - AI agent instructions and code style
- [Step 0: Project Setup](./docs/00-project-setup.md)
- [Step 1: Database Setup](./docs/01-database-setup.md)
- [Step 2: Core API Integrations](./docs/02-core-api-integrations.md)
- [Step 3: Gaming Integrations](./docs/03-gaming-integrations.md)
- [Step 4: Schedule System](./docs/04-schedule-system.md)
- [Step 5: Widget System](./docs/05-widget-system.md)
- [Step 6: Dashboard Renderer](./docs/06-dashboard-renderer.md)
- [Step 7: Admin UI](./docs/07-admin-ui.md)
- [Step 8: GitHub Actions](./docs/08-github-actions.md)
- [Step 9: Deployment](./docs/09-deployment.md)
