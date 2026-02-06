# Step 6: Dashboard Renderer

## Overview

Create the main dashboard page that TRMNL will screenshot. This page must render completely within 5 seconds, use only absolute URLs, and be exactly 800×480 pixels.

## TRMNL Requirements

### Critical Constraints

- **Viewport**: Exactly 800 × 480 pixels
- **Render Time**: Page must fully render within 5 seconds
- **URLs**: All CSS/JS/images must use absolute URLs
- **No JavaScript**: Content must work without JS (SSR required)
- **Static Content**: No animations, transitions, or dynamic updates

### TRMNL Assets

Include TRMNL's official CSS and JS for proper rendering:

```html
<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css" />
<script src="https://usetrmnl.com/js/latest/plugins.js" async />
```

---

## Implementation

### 6.1 Create Dashboard Data Loader

Create `src/lib/dashboard/loader.ts`:

```typescript
import { getScheduleContext } from '@/lib/schedule/context';
import { getWidgetsForContext, getActiveRoutine } from '@/lib/schedule/widgets';
import { cacheGet, CACHE_KEYS } from '@/lib/cache/redis';
import { ScheduleContext, WidgetDisplay } from '@/types/schedule';
import { WeatherData } from '@/types/weather';
import { TransitData } from '@/types/transport';
import { CalendarData } from '@/types/calendar';
import { GamingData } from '@/types/gaming';
import { DashboardData } from '@/lib/api/refresh';

export interface DashboardRenderData {
  context: ScheduleContext;
  widgets: WidgetDisplay[];
  routine: { name: string; steps: string[] } | null;
  data: {
    weather: WeatherData | null;
    transit: TransitData | null;
    calendar: CalendarData | null;
    gaming: GamingData | null;
  };
  meta: {
    renderedAt: string;
    dataAge: string | null;
  };
}

/**
 * Load all data needed to render the dashboard
 * This is called on every page render (server-side)
 */
export async function loadDashboardData(): Promise<DashboardRenderData> {
  // Get schedule context
  const context = await getScheduleContext();

  // Get widgets for this context
  const widgets = await getWidgetsForContext(context);

  // Get active routine if any
  const routine = await getActiveRoutine(context);

  // Get cached data (don't fetch fresh - that's done by the refresh cron)
  const cachedData = await cacheGet<DashboardData>(CACHE_KEYS.DASHBOARD_DATA);

  const weather = cachedData?.weather || await cacheGet<WeatherData>(CACHE_KEYS.WEATHER);
  const transit = cachedData?.transit || await cacheGet<TransitData>(CACHE_KEYS.TRANSIT);
  const calendar = cachedData?.calendar || await cacheGet<CalendarData>(CACHE_KEYS.CALENDAR);
  const gaming = cachedData?.gaming || null;

  // Calculate data age
  const dataAge = cachedData?.refreshedAt
    ? getDataAgeString(cachedData.refreshedAt)
    : null;

  return {
    context,
    widgets,
    routine,
    data: {
      weather,
      transit,
      calendar,
      gaming,
    },
    meta: {
      renderedAt: new Date().toISOString(),
      dataAge,
    },
  };
}

/**
 * Format data age for display
 */
function getDataAgeString(refreshedAt: string): string {
  const refreshedTime = new Date(refreshedAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - refreshedTime.getTime()) / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}
```

### 6.2 Create Widget Renderer

Create `src/lib/dashboard/widget-renderer.tsx`:

```typescript
import { WidgetDisplay } from '@/types/schedule';
import { WeatherData } from '@/types/weather';
import { TransitData } from '@/types/transport';
import { CalendarData } from '@/types/calendar';
import { GamingData } from '@/types/gaming';
import {
  WeatherWidget,
  TransitWidget,
  CalendarWidget,
  GamingWidget,
  RoutineWidget,
  MedicationWidget,
} from '@/components/widgets';

interface WidgetData {
  weather: WeatherData | null;
  transit: TransitData | null;
  calendar: CalendarData | null;
  gaming: GamingData | null;
}

interface RoutineData {
  name: string;
  steps: string[];
}

/**
 * Render a single widget based on its type and configuration
 */
export function renderWidget(
  widget: WidgetDisplay,
  data: WidgetData,
  routine: RoutineData | null
): JSX.Element | null {
  const size = widget.size;

  switch (widget.type) {
    case 'weather':
      return (
        <WeatherWidget
          key="weather"
          data={data.weather}
          size={size}
          showForecast={size !== 'small'}
        />
      );

    case 'transit':
      return (
        <TransitWidget
          key="transit"
          data={data.transit}
          size={size}
          limit={size === 'large' ? 6 : 4}
        />
      );

    case 'calendar':
      return (
        <CalendarWidget
          key="calendar"
          data={data.calendar}
          size={size}
          mode={size === 'large' ? 'today' : 'upcoming'}
        />
      );

    case 'gaming':
      return (
        <GamingWidget
          key="gaming"
          data={data.gaming}
          size={size}
          limit={size === 'large' ? 5 : 3}
        />
      );

    case 'routine':
      if (!routine) return null;
      const category = (widget.config?.category as string) || 'custom';
      return (
        <RoutineWidget
          key={`routine-${category}`}
          name={routine.name}
          steps={routine.steps.map((step) => ({ title: step }))}
          size={size}
          category={category as 'morning' | 'evening' | 'skincare' | 'medication' | 'custom'}
        />
      );

    case 'medication':
      // For now, show placeholder - would come from database
      return (
        <MedicationWidget
          key="medication"
          medications={[
            { name: 'Vitamins', dosage: 'With food', taken: false },
          ]}
          size={size === 'large' ? 'medium' : 'small'}
        />
      );

    default:
      return null;
  }
}

/**
 * Render all widgets for the dashboard
 */
export function renderWidgets(
  widgets: WidgetDisplay[],
  data: WidgetData,
  routine: RoutineData | null
): JSX.Element[] {
  return widgets
    .map((widget) => renderWidget(widget, data, routine))
    .filter((element): element is JSX.Element => element !== null);
}
```

### 6.3 Create Dashboard Layout

Create `src/lib/dashboard/layout.ts`:

```typescript
import { WidgetDisplay } from '@/types/schedule';

export interface LayoutSlot {
  id: string;
  row: number;
  col: number;
  width: 1 | 2;  // Grid columns
  height: 1 | 2; // Grid rows
}

/**
 * Calculate optimal layout for widgets
 * Dashboard is 2 columns × 2 rows (4 slots)
 * Widgets can span 1 or 2 columns/rows
 */
export function calculateLayout(widgets: WidgetDisplay[]): Map<WidgetDisplay, LayoutSlot> {
  const layout = new Map<WidgetDisplay, LayoutSlot>();

  // Grid state: true = occupied
  const grid = [
    [false, false],  // Row 0
    [false, false],  // Row 1
  ];

  let slotId = 0;

  for (const widget of widgets) {
    const slot = findSlotForWidget(grid, widget.size);

    if (!slot) {
      // No space left
      break;
    }

    layout.set(widget, {
      id: `slot-${slotId++}`,
      ...slot,
    });

    // Mark grid cells as occupied
    for (let r = slot.row; r < slot.row + slot.height; r++) {
      for (let c = slot.col; c < slot.col + slot.width; c++) {
        if (grid[r] && grid[r][c] !== undefined) {
          grid[r][c] = true;
        }
      }
    }
  }

  return layout;
}

/**
 * Find a slot for a widget based on its size
 */
function findSlotForWidget(
  grid: boolean[][],
  size: WidgetDisplay['size']
): Omit<LayoutSlot, 'id'> | null {
  const requirements = getSizeRequirements(size);

  // Try to find a slot that fits
  for (let row = 0; row <= 2 - requirements.height; row++) {
    for (let col = 0; col <= 2 - requirements.width; col++) {
      if (canFit(grid, row, col, requirements.width, requirements.height)) {
        return {
          row,
          col,
          width: requirements.width as 1 | 2,
          height: requirements.height as 1 | 2,
        };
      }
    }
  }

  return null;
}

/**
 * Check if a widget can fit at a position
 */
function canFit(
  grid: boolean[][],
  row: number,
  col: number,
  width: number,
  height: number
): boolean {
  for (let r = row; r < row + height; r++) {
    for (let c = col; c < col + width; c++) {
      if (!grid[r] || grid[r][c] === undefined || grid[r][c]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Convert widget size to grid requirements
 */
function getSizeRequirements(size: WidgetDisplay['size']): { width: number; height: number } {
  switch (size) {
    case 'small':
      return { width: 1, height: 1 };
    case 'medium':
      return { width: 1, height: 1 };
    case 'large':
      return { width: 1, height: 2 };
    case 'full':
      return { width: 2, height: 1 };
    default:
      return { width: 1, height: 1 };
  }
}

/**
 * Generate CSS grid style for a slot
 */
export function getSlotStyle(slot: LayoutSlot): React.CSSProperties {
  return {
    gridColumn: `${slot.col + 1} / span ${slot.width}`,
    gridRow: `${slot.row + 1} / span ${slot.height}`,
  };
}
```

### 6.4 Create Main Dashboard Page

Update `src/app/(dashboard)/page.tsx` to use the shared `DashboardScreen` component:

```typescript
import { loadDashboardData } from '@/lib/dashboard/loader';
import { DashboardScreen } from '@/components/DashboardScreen';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

// Disable caching for this page
export const revalidate = 0;

export default async function DashboardPage() {
  const dashboardData = await loadDashboardData();

  return <DashboardScreen data={dashboardData} />;
}
```

### 6.5 Update Dashboard Layout

Update `src/app/(dashboard)/layout.tsx`:

> **Important:** Do not add `<html>` or `<body>` tags here — the root layout already provides them. This layout only wraps dashboard-specific content.

```typescript
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TRMNL Dashboard',
  description: 'Custom e-ink dashboard for TRMNL',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 800,
  height: 480,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

### 6.6 Create Error Boundary

Create `src/app/(dashboard)/error.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { EinkIcon } from '@/components/ui/EinkIcon';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="trmnl-container flex items-center justify-center bg-eink-white">
      <div className="text-center p-8">
        <EinkIcon name="alert" size="xl" className="mb-4" />

        <h1 className="text-eink-xl font-bold mb-2">Dashboard Error</h1>

        <p className="text-eink-base text-eink-dark mb-4">
          Something went wrong loading the dashboard.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre className="text-eink-xs text-left bg-eink-light p-2 mb-4 max-w-md overflow-auto">
            {error.message}
          </pre>
        )}

        <button
          onClick={reset}
          className="eink-button"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

### 6.7 Create Loading State

Create `src/app/(dashboard)/loading.tsx`:

```typescript
export default function DashboardLoading() {
  return (
    <div className="trmnl-container flex items-center justify-center bg-eink-white">
      <div className="text-center">
        <p className="text-eink-lg font-bold">Loading...</p>
        <p className="text-eink-sm text-eink-dark mt-2">Fetching dashboard data</p>
      </div>
    </div>
  );
}
```

### 6.8 Create Not Found Page

Create `src/app/(dashboard)/not-found.tsx`:

```typescript
import { EinkIcon } from '@/components/ui/EinkIcon';

export default function DashboardNotFound() {
  return (
    <div className="trmnl-container flex items-center justify-center bg-eink-white">
      <div className="text-center">
        <div className="text-eink-3xl font-bold mb-2">404</div>
        <p className="text-eink-lg text-eink-dark">Page not found</p>
      </div>
    </div>
  );
}
```

### 6.9 Extract Shared Dashboard Component

To avoid duplicating the dashboard rendering between the main page and the preview page, extract the core rendering into a shared component.

Create `src/components/DashboardScreen.tsx`:

```typescript
import { renderWidgets } from '@/lib/dashboard/widget-renderer';
import { calculateLayout, getSlotStyle } from '@/lib/dashboard/layout';
import { AlertBanner } from '@/components/widgets';
import { DashboardRenderData } from '@/lib/dashboard/loader';
import { LOCATION } from '@/lib/config';

interface DashboardScreenProps {
  data: DashboardRenderData;
  footerLabel?: string;
}

export function DashboardScreen({ data, footerLabel = 'TRMNL Dashboard' }: DashboardScreenProps) {
  const { context, widgets, routine, data: widgetData, meta } = data;
  const layout = calculateLayout(widgets);
  const renderedWidgets = renderWidgets(widgets, widgetData, routine);
  const now = new Date();

  return (
    <div className="trmnl-container flex flex-col bg-eink-white">
      {context.specialConditions.length > 0 && (
        <AlertBanner conditions={context.specialConditions} />
      )}

      <header className="flex items-center justify-between px-3 py-2 border-b-2 border-eink-black">
        <div className="flex items-center gap-4">
          <time className="text-eink-2xl font-bold">
            {now.toLocaleTimeString(LOCATION.locale, {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </time>
          <span className="text-eink-base text-eink-dark">
            {now.toLocaleDateString(LOCATION.locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-eink-xs text-eink-dark">
          <span className="uppercase">{context.dayType}</span>
          <span>•</span>
          <span className="uppercase">{context.timeBlock}</span>
          {meta.dataAge && (
            <>
              <span>•</span>
              <span>{meta.dataAge}</span>
            </>
          )}
        </div>
      </header>

      <main
        className="flex-1 p-2 grid gap-2"
        style={{
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
        }}
      >
        {renderedWidgets.map((widget, index) => {
          const widgetConfig = widgets[index];
          const slot = widgetConfig ? layout.get(widgetConfig) : undefined;

          return (
            <div key={index} style={slot ? getSlotStyle(slot) : undefined}>
              {widget}
            </div>
          );
        })}

        {renderedWidgets.length === 0 && (
          <div className="col-span-2 row-span-2 flex items-center justify-center text-eink-dark">
            <div className="text-center">
              <p className="text-eink-lg mb-2">No widgets configured</p>
              <p className="text-eink-sm">Check schedule settings</p>
            </div>
          </div>
        )}
      </main>

      <footer className="px-3 py-1 border-t border-eink-light flex justify-between text-eink-xs text-eink-dark">
        <span>{footerLabel}</span>
        <span>Updated {meta.renderedAt.split('T')[1].slice(0, 5)}</span>
      </footer>
    </div>
  );
}
```

### 6.10 Create Preview Mode (Development)

Create `src/app/(dashboard)/preview/page.tsx` — uses the shared `DashboardScreen` component wrapped in a device frame:

```typescript
import { loadDashboardData } from '@/lib/dashboard/loader';
import { DashboardScreen } from '@/components/DashboardScreen';

export const dynamic = 'force-dynamic';

export default async function PreviewPage() {
  const dashboardData = await loadDashboardData();

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-8">
      <div className="relative">
        <div className="absolute -top-8 left-0 text-white text-sm">
          TRMNL Preview • 800x480 • {dashboardData.context.dayType} / {dashboardData.context.timeBlock}
        </div>

        <div className="bg-gray-900 p-4 rounded-lg shadow-2xl">
          <DashboardScreen data={dashboardData} footerLabel="Preview Mode" />
        </div>

        <div className="absolute -bottom-16 left-0 text-white text-xs font-mono">
          <div>Widgets: {dashboardData.widgets.map(w => w.type).join(', ')}</div>
          <div>Data age: {dashboardData.meta.dataAge || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}
```

### 6.10 Verify Setup

```bash
# Start the dev server
pnpm dev

# View main dashboard
open http://localhost:3000

# View preview with device frame
open http://localhost:3000/preview

# Test with TRMNL viewport
# In browser DevTools, set viewport to 800x480
```

## Files Created

- `src/lib/dashboard/loader.ts`
- `src/lib/dashboard/widget-renderer.tsx`
- `src/lib/dashboard/layout.ts`
- `src/components/DashboardScreen.tsx`
- `src/app/(dashboard)/page.tsx` (updated)
- `src/app/(dashboard)/layout.tsx` (updated)
- `src/app/(dashboard)/error.tsx`
- `src/app/(dashboard)/loading.tsx`
- `src/app/(dashboard)/not-found.tsx`
- `src/app/(dashboard)/preview/page.tsx`

## Testing Checklist

- [ ] Dashboard renders at exactly 800×480
- [ ] Page loads within 5 seconds
- [ ] Widgets display correctly based on schedule
- [ ] Alert banner appears for special conditions
- [ ] Header shows correct time and context
- [ ] Error state displays gracefully
- [ ] No JavaScript errors in console
- [ ] All fonts load correctly

## TRMNL Screenshot Testing

1. Deploy to Vercel (or use ngrok for local testing)
2. In TRMNL dashboard, create a new plugin
3. Set the URL to your dashboard
4. Preview the screenshot
5. Verify colors render correctly in grayscale

## Performance Tips

- Use `force-dynamic` to ensure fresh data on each request
- Cache API data aggressively (done in refresh cron)
- Minimize JavaScript (use server components)
- Preload fonts to avoid FOUT
- Keep widget count reasonable (4-6 max)

## Next Step

Proceed to [Step 7: Admin UI](./07-admin-ui.md) to create the schedule and routine management interface.
