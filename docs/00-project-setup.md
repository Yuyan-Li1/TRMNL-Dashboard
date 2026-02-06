# Step 0: Project Setup

## Overview

Initialize a new Next.js 16 project with TypeScript, React 19, Tailwind CSS 4, and pnpm as the package manager.

## Prerequisites

- Node.js 20+ installed
- pnpm installed globally (`npm install -g pnpm`)

## Implementation

### 0.1 Create Next.js Project

```bash
pnpm create next-app@latest trmnl-dashboard --typescript --tailwind --app --src-dir --import-alias "@/*"
cd trmnl-dashboard
```

When prompted, accept the defaults (TypeScript, Tailwind CSS, App Router, `src/` directory).

> **Note:** This project uses Next.js 16, React 19, and Tailwind CSS 4. Tailwind 4 uses CSS-based configuration (in `globals.css`) instead of the older `tailwind.config.ts` file.

### 0.2 Install Core Dependencies

```bash
# Database and caching
pnpm add mongoose @upstash/redis

# Google APIs
pnpm add googleapis

# Gaming APIs
pnpm add psn-api steamapi

# Date handling
pnpm add date-fns date-fns-tz

# Dev dependencies
pnpm add -D @types/node
```

### 0.3 Configure TypeScript

Update `tsconfig.json` to enable strict mode and add path aliases:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 0.4 Configure Tailwind for E-ink

> **Tailwind CSS 4** uses CSS-based configuration instead of `tailwind.config.ts`. All e-ink theme tokens (colors, font sizes, dimensions) are defined directly in `globals.css` using `@theme` — see section 0.8 below. You do not need a `tailwind.config.ts` file.

### 0.5 Create Directory Structure

```bash
# Create all directories
mkdir -p src/app/\(dashboard\)
mkdir -p src/app/\(admin\)/schedules
mkdir -p src/app/\(admin\)/routines
mkdir -p src/app/\(admin\)/tokens
mkdir -p src/app/api/refresh
mkdir -p src/app/api/schedule
mkdir -p src/app/api/health
mkdir -p src/components/widgets
mkdir -p src/components/admin
mkdir -p src/components/ui
mkdir -p src/lib/api
mkdir -p src/lib/db/models
mkdir -p src/lib/db/queries
mkdir -p src/lib/cache
mkdir -p src/lib/schedule
mkdir -p src/lib/utils
mkdir -p src/types
mkdir -p public/icons
```

### 0.6 Create Environment Template

Create `.env.example`:

```env
# ===========================================
# TRMNL Dashboard Environment Variables
# ===========================================

# MongoDB Atlas
# Get from: https://www.mongodb.com/cloud/atlas
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/trmnl?retryWrites=true&w=majority

# Upstash Redis
# Get from: https://upstash.com
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Transport NSW
# Get from: https://opendata.transport.nsw.gov.au
TFNSW_API_KEY=your-api-key-here

# Steam
# Get from: https://steamcommunity.com/dev/apikey
STEAM_API_KEY=your-api-key-here
STEAM_ID=your-steam-id-64

# OpenXBL (Xbox)
# Get from: https://xbl.io
OPENXBL_API_KEY=your-api-key-here

# PlayStation Network
# Get manually from: https://ca.account.sony.com/api/v1/ssocookie
PSN_NPSSO=your-64-character-npsso-token

# Google Calendar (Service Account)
# Get from: https://console.cloud.google.com
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your-email@gmail.com

# GitHub Actions Authentication
# Generate a random string for this
CRON_SECRET=generate-a-random-32-character-string

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 0.7 Create Base Types

Create `src/types/index.ts`:

```typescript
// Day types for schedule system
export const DAY_TYPES = ['office', 'wfh', 'weekend'] as const;
export type DayType = typeof DAY_TYPES[number];

// Time blocks throughout the day
export const TIME_BLOCKS = ['morning', 'workday', 'evening', 'night'] as const;
export type TimeBlock = typeof TIME_BLOCKS[number];

// Widget types available in the dashboard
export const WIDGET_TYPES = [
  'weather',
  'transit',
  'calendar',
  'gaming',
  'routine',
  'medication',
] as const;
export type WidgetType = typeof WIDGET_TYPES[number];

// Token health status
export const TOKEN_STATUSES = ['healthy', 'expiring_soon', 'expired', 'error'] as const;
export type TokenStatus = typeof TOKEN_STATUSES[number];

// Service identifiers for token tracking
export const SERVICES = ['psn', 'xbox', 'steam', 'google', 'tfnsw'] as const;
export type Service = typeof SERVICES[number];
```

### 0.8 Create Centralized Config

Create `src/lib/config.ts` to keep all location/app constants in one place:

```typescript
// Centralized configuration - edit these values for your setup

export const LOCATION = {
  // Sydney coordinates (change for your city)
  latitude: -33.8688,
  longitude: 151.2093,
  timezone: 'Australia/Sydney',
  locale: 'en-AU',
} as const;

export const STATION = {
  // Lidcombe station (change for your commute station)
  stopId: '10101331',  // Departure Monitor stop ID
  name: 'Lidcombe',
} as const;

export const TRMNL = {
  width: 800,
  height: 480,
  refreshIntervalMinutes: 30,
  bufferMinutes: 30,  // How early to show upcoming content
} as const;
```

### 0.9 Create Environment Validation

Create `src/lib/env.ts` to validate required env vars at startup:

```typescript
/**
 * Validate that required environment variables are set.
 * Call this in API routes / server components to fail fast
 * with a clear message instead of cryptic runtime errors.
 */
export function validateEnv(
  required: string[]
): Record<string, string> {
  const missing: string[] = [];
  const values: Record<string, string> = {};

  for (const key of required) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return values;
}

// Pre-defined groups for common checks
export const ENV_GROUPS = {
  database: ['MONGODB_URI'],
  cache: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  transit: ['TFNSW_API_KEY'],
  steam: ['STEAM_API_KEY', 'STEAM_ID'],
  xbox: ['OPENXBL_API_KEY'],
  psn: ['PSN_NPSSO'],
  google: ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CALENDAR_ID'],
  cron: ['CRON_SECRET'],
} as const;
```

### 0.10 Create Global CSS for E-ink

Update `src/app/globals.css`. In Tailwind CSS 4, use `@import` for Tailwind and `@theme` for custom tokens:

```css
@import "tailwindcss";

/* Inter font for e-ink readability — must be before any @layer rules */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

/* TRMNL E-ink Display Theme */
@theme {
  /* E-ink only has 4 shades */
  --color-eink-black: #000000;
  --color-eink-dark: #555555;
  --color-eink-light: #aaaaaa;
  --color-eink-white: #ffffff;

  /* TRMNL display dimensions */
  --width-trmnl: 800px;
  --height-trmnl: 480px;

  /* Font sizes optimized for e-ink readability */
  --font-size-eink-xs: 12px;
  --line-height-eink-xs: 16px;
  --font-size-eink-sm: 14px;
  --line-height-eink-sm: 20px;
  --font-size-eink-base: 16px;
  --line-height-eink-base: 24px;
  --font-size-eink-lg: 20px;
  --line-height-eink-lg: 28px;
  --font-size-eink-xl: 24px;
  --line-height-eink-xl: 32px;
  --font-size-eink-2xl: 32px;
  --line-height-eink-2xl: 40px;
  --font-size-eink-3xl: 48px;
  --line-height-eink-3xl: 56px;
}

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }

  body {
    @apply bg-eink-white text-eink-black;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .eink-card {
    @apply border-2 border-eink-black bg-eink-white p-4;
  }

  .eink-button {
    @apply border-2 border-eink-black bg-eink-white px-4 py-2 font-semibold;
    @apply hover:bg-eink-light active:bg-eink-dark active:text-eink-white;
  }

  .trmnl-container {
    width: 800px;
    height: 480px;
    @apply overflow-hidden bg-eink-white;
  }
}

@layer utilities {
  .text-eink-primary {
    @apply text-eink-black;
  }

  .text-eink-secondary {
    @apply text-eink-dark;
  }

  .text-eink-muted {
    @apply text-eink-light;
  }

  .border-eink {
    @apply border-2 border-eink-black;
  }

  .border-eink-subtle {
    @apply border border-eink-dark;
  }
}
```

### 0.11 Create Placeholder Dashboard Page

Create `src/app/(dashboard)/page.tsx`:

```typescript
export default function DashboardPage() {
  return (
    <div className="trmnl-container flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-eink-2xl font-bold mb-4">TRMNL Dashboard</h1>
        <p className="text-eink-lg text-eink-secondary">
          Setup in progress...
        </p>
      </div>
    </div>
  );
}
```

Create `src/app/(dashboard)/layout.tsx`:

> **Important:** In Next.js App Router, only the root layout (`src/app/layout.tsx`) should contain `<html>` and `<body>` tags. Route group layouts must not duplicate them.

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TRMNL Dashboard',
  description: 'Custom e-ink dashboard for TRMNL',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

The TRMNL CSS/JS assets are loaded in the root layout (or via the dashboard page's `<head>` exports). See Step 6 for details.

### 0.12 Add npm Scripts

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf .next node_modules",
    "db:seed": "tsx src/lib/db/seed.ts"
  }
}
```

### 0.13 Verify Setup

```bash
# Run type check
pnpm type-check

# Start development server
pnpm dev
```

Open <http://localhost:3000> - you should see the placeholder dashboard.

## Files Created

- `tsconfig.json` (modified)
- `.env.example`
- `src/types/index.ts`
- `src/lib/config.ts`
- `src/lib/env.ts`
- `src/app/globals.css` (modified)
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/layout.tsx`

## Next Step

Proceed to [Step 1: Database Setup](./01-database-setup.md) to configure MongoDB Atlas and Upstash Redis.
