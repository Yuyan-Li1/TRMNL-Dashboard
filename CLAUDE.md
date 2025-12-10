# CLAUDE.md - AI Agent Instructions

## Project Overview

This is a custom TRMNL e-ink dashboard built with Next.js 14, TypeScript, and hosted on Vercel (Hobby plan). The dashboard displays different content based on day type (office/WFH/weekend) and time of day.

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm (required)
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB Atlas (free tier)
- **Cache**: Upstash Redis
- **Styling**: Tailwind CSS (e-ink optimized)
- **Deployment**: Vercel Hobby plan
- **Scheduling**: GitHub Actions (workaround for Vercel cron limits)

## Key Constraints

### TRMNL Display Constraints

- **Viewport**: 800 × 480 pixels (landscape)
- **Color depth**: 2-bit grayscale (black, white, light gray, dark gray)
- **Render time**: Page must fully render within 5 seconds
- **URLs**: All CSS/JS/images must use absolute URLs
- **No gradients, no thin lines under 2px, no anti-aliased graphics

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
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # TRMNL-facing routes
│   ├── (admin)/            # Admin UI routes
│   └── api/                # API routes
├── components/
│   ├── widgets/            # Dashboard widgets
│   ├── admin/              # Admin UI components
│   └── ui/                 # Shared UI components
├── lib/
│   ├── api/                # External API clients
│   ├── db/                 # Database models and queries
│   ├── schedule/           # Schedule logic
│   └── utils/              # Utility functions
└── types/                  # TypeScript type definitions
```

### Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

### Environment Variables

All env vars must be prefixed appropriately:

- `NEXT_PUBLIC_*` for client-side vars
- No prefix for server-only vars

## Implementation Notes

### Widget System

Each widget must:

1. Accept a `config` prop for customization
2. Handle loading and error states gracefully
3. Display fallback content if data is unavailable
4. Respect e-ink display constraints (high contrast, no animations)

### Schedule System

The schedule determines which widgets appear based on:

1. **Day type**: office, wfh, weekend
2. **Time block**: morning, workday, evening, night
3. **Special conditions**: rain, train delays, temperature swing

### Caching Strategy

- Weather: 15-minute TTL
- Transit: 5-minute TTL
- Calendar: 10-minute TTL
- Gaming: 1-hour TTL
- Token health: Check on each refresh

### Error Handling

- Never crash the dashboard render
- Show graceful degradation (hide widget if data unavailable)
- Log errors to console for debugging
- Display token/auth status in admin UI

## Manual Breakpoints

The implementation has several points where manual action is required:

1. **Account Registration**: MongoDB Atlas, Upstash, Transport NSW, Steam, OpenXBL
2. **Token Retrieval**: PSN NPSSO (manual browser login required)
3. **Google Cloud Setup**: Service account creation and calendar sharing
4. **Environment Variables**: Must be added to Vercel dashboard
5. **GitHub Repository**: Must create and configure GitHub Actions secrets

## Testing Commands

```bash
# Development
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build
pnpm build

# Test TRMNL render (800x480 viewport)
# Open http://localhost:3000 and use browser dev tools to set viewport
```

## Common Issues

### PSN Token Expired

If PSN data shows "Token expired", manually refresh NPSSO:

1. Visit <https://www.playstation.com/> and sign in
2. Visit <https://ca.account.sony.com/api/v1/ssocookie>
3. Copy the npsso value
4. Update `PSN_NPSSO` in Vercel environment variables
5. Redeploy or wait for next refresh cycle

### MongoDB Connection Issues

- Ensure IP whitelist includes `0.0.0.0/0` for Vercel serverless
- Check connection string format includes `retryWrites=true&w=majority`

### Transport NSW 403 Errors

- API key may have expired; regenerate at opendata.transport.nsw.gov.au
- Ensure correct header format: `Authorization: apikey YOUR_KEY`
