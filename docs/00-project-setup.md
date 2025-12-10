# Step 0: Project Setup

## Overview

Initialize a new Next.js 14 project with TypeScript, Tailwind CSS, and pnpm as the package manager.

## Prerequisites

- Node.js 20+ installed
- pnpm installed globally (`npm install -g pnpm`)

## Implementation

### 0.1 Create Next.js Project

```bash
pnpm create next-app@latest trmnl-dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd trmnl-dashboard
```

When prompted:

- Would you like to use TypeScript? **Yes**
- Would you like to use ESLint? **Yes**
- Would you like to use Tailwind CSS? **Yes**
- Would you like to use `src/` directory? **Yes**
- Would you like to use App Router? **Yes**
- Would you like to customize the default import alias? **Yes** → `@/*`

### 0.2 Install Core Dependencies

```bash
# Database and caching
pnpm add mongoose @upstash/redis

# Google APIs
pnpm add googleapis

# Transport NSW (GTFS)
pnpm add gtfs-realtime-bindings

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

Update `tailwind.config.ts` with e-ink optimized colors:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // E-ink only has 4 shades - optimize for these
      colors: {
        eink: {
          black: '#000000',
          dark: '#555555',   // Dark gray
          light: '#AAAAAA',  // Light gray
          white: '#FFFFFF',
        },
      },
      // TRMNL display dimensions
      width: {
        'trmnl': '800px',
      },
      height: {
        'trmnl': '480px',
      },
      // Font sizes optimized for e-ink readability
      fontSize: {
        'eink-xs': ['12px', '16px'],
        'eink-sm': ['14px', '20px'],
        'eink-base': ['16px', '24px'],
        'eink-lg': ['20px', '28px'],
        'eink-xl': ['24px', '32px'],
        'eink-2xl': ['32px', '40px'],
        'eink-3xl': ['48px', '56px'],
      },
      fontFamily: {
        'eink': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

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

### 0.8 Create Global CSS for E-ink

Update `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* TRMNL E-ink Display Optimization */
@layer base {
  /* Import Inter font for e-ink readability */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

  html {
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* E-ink displays work best with high contrast */
  body {
    @apply bg-eink-white text-eink-black;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  /* E-ink card component */
  .eink-card {
    @apply border-2 border-eink-black bg-eink-white p-4;
  }

  /* E-ink button */
  .eink-button {
    @apply border-2 border-eink-black bg-eink-white px-4 py-2 font-semibold;
    @apply hover:bg-eink-light active:bg-eink-dark active:text-eink-white;
  }

  /* Dashboard container - exactly TRMNL dimensions */
  .trmnl-container {
    width: 800px;
    height: 480px;
    @apply overflow-hidden bg-eink-white;
  }
}

@layer utilities {
  /* High contrast text utilities */
  .text-eink-primary {
    @apply text-eink-black;
  }

  .text-eink-secondary {
    @apply text-eink-dark;
  }

  .text-eink-muted {
    @apply text-eink-light;
  }

  /* Border utilities for e-ink */
  .border-eink {
    @apply border-2 border-eink-black;
  }

  .border-eink-subtle {
    @apply border border-eink-dark;
  }
}
```

### 0.9 Create Placeholder Dashboard Page

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
  return (
    <html lang="en">
      <head>
        {/* TRMNL requires these for proper rendering */}
        <link
          rel="stylesheet"
          href="https://usetrmnl.com/css/latest/plugins.css"
        />
        <script src="https://usetrmnl.com/js/latest/plugins.js" async />
      </head>
      <body className="m-0 p-0">{children}</body>
    </html>
  );
}
```

### 0.10 Add npm Scripts

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

### 0.11 Verify Setup

```bash
# Run type check
pnpm type-check

# Start development server
pnpm dev
```

Open <http://localhost:3000> - you should see the placeholder dashboard.

## Files Created

- `tsconfig.json` (modified)
- `tailwind.config.ts` (modified)
- `.env.example`
- `src/types/index.ts`
- `src/app/globals.css` (modified)
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/layout.tsx`

## Next Step

Proceed to [Step 1: Database Setup](./01-database-setup.md) to configure MongoDB Atlas and Upstash Redis.
