# Step 4: Schedule System

## Overview

Implement the schedule system that determines which widgets to display based on day type (office, WFH, weekend), time of day (morning, workday, evening, night), and special conditions (rain expected, train delays).

## Key Concepts

### Day Types

- **office**: Days when commuting to the office (e.g., Mon-Wed)
- **wfh**: Work from home days (e.g., Thu-Fri)
- **weekend**: Non-work days (Sat-Sun)

### Time Blocks

- **morning**: Early morning routine time (e.g., 6:00-9:00)
- **workday**: Working hours (e.g., 9:00-18:00)
- **evening**: Evening wind-down (e.g., 18:00-22:00)
- **night**: Late night (e.g., 22:00-6:00)

### Refresh Buffer

TRMNL displays refresh at intervals (e.g., 30 minutes). Content must appear **before** it's needed to ensure the user sees it at the right time.

```text
Example: Wake at 7:50 AM with 30-min refresh interval

7:20 AM refresh → Shows morning routine (buffer accounts for next refresh)
7:50 AM refresh → Still shows morning routine
8:20 AM refresh → Transitions to workday content
```

---

## Implementation

### 4.1 Create Schedule Context Types

Update `src/types/schedule.ts`:

```typescript
import { DayType, TimeBlock, WidgetType } from './index';

// Current schedule context (what should display now)
export interface ScheduleContext {
  dayType: DayType;
  timeBlock: TimeBlock;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm
  dayOfWeek: number;      // 0-6 (Sunday-Saturday)
  isHoliday: boolean;
  specialConditions: SpecialCondition[];
}

// Special conditions that affect widget display
export interface SpecialCondition {
  type: 'rain_expected' | 'train_delay' | 'hot_day' | 'cold_day' | 'meeting_soon';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data?: Record<string, unknown>;
}

// Widget display configuration for current context
export interface WidgetDisplay {
  type: WidgetType;
  priority: number;
  size: 'small' | 'medium' | 'large' | 'full';
  config?: Record<string, unknown>;
}

// Time block definition with buffer consideration
export interface TimeBlockDefinition {
  name: TimeBlock;
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  displayStart: string;  // HH:mm - when to START showing (with buffer)
  displayEnd: string;    // HH:mm - when to STOP showing (with buffer)
}

// Schedule configuration
export interface ScheduleConfig {
  refreshIntervalMinutes: number;  // TRMNL refresh interval
  bufferMinutes: number;           // How early to show content
  timezone: string;
}
```

### 4.2 Create Date Utilities

Create `src/lib/utils/date.ts`:

```typescript
import { format, parse, isWithinInterval, addMinutes, subMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { LOCATION } from '@/lib/config';

const DEFAULT_TIMEZONE = LOCATION.timezone;

/**
 * Get current time in configured timezone
 */
export function getNow(timezone: string = DEFAULT_TIMEZONE): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Format time as HH:mm
 */
export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse HH:mm time string to today's date
 */
export function parseTimeToday(timeStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const now = getNow(timezone);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);

  return result;
}

/**
 * Check if a given time is within a time range
 * Handles overnight ranges (e.g., 22:00 - 06:00)
 */
export function isWithinTimeRange(
  current: Date,
  startTime: string,
  endTime: string,
  _timezone?: string
): boolean {
  const currentMinutes = current.getHours() * 60 + current.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight range (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Apply buffer to a time (subtract minutes)
 */
export function applyBuffer(timeStr: string, bufferMinutes: number): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes - bufferMinutes;

  // Handle negative (wrap to previous day)
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(timezone: string = DEFAULT_TIMEZONE): number {
  return getNow(timezone).getDay();
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date = getNow()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
```

### 4.3 Create Schedule Context Logic

Create `src/lib/schedule/context.ts`:

```typescript
import { DayType, TimeBlock } from '@/types';
import { ScheduleContext, SpecialCondition, ScheduleConfig } from '@/types/schedule';
import { getNow, formatTime, formatDate, getDayOfWeek, isWithinTimeRange, applyBuffer } from '@/lib/utils/date';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Schedule } from '@/lib/db/models/schedule';
import { LOCATION, TRMNL } from '@/lib/config';

// Default schedule configuration
const DEFAULT_CONFIG: ScheduleConfig = {
  refreshIntervalMinutes: TRMNL.refreshIntervalMinutes,
  bufferMinutes: TRMNL.bufferMinutes,
  timezone: LOCATION.timezone,
};

// Default time block definitions
const DEFAULT_TIME_BLOCKS: Record<DayType, { name: TimeBlock; start: string; end: string }[]> = {
  office: [
    { name: 'morning', start: '06:00', end: '09:00' },
    { name: 'workday', start: '09:00', end: '18:00' },
    { name: 'evening', start: '18:00', end: '22:00' },
    { name: 'night', start: '22:00', end: '06:00' },
  ],
  wfh: [
    { name: 'morning', start: '07:00', end: '09:00' },
    { name: 'workday', start: '09:00', end: '18:00' },
    { name: 'evening', start: '18:00', end: '22:00' },
    { name: 'night', start: '22:00', end: '07:00' },
  ],
  weekend: [
    { name: 'morning', start: '08:00', end: '12:00' },
    { name: 'workday', start: '12:00', end: '18:00' },  // "Daytime" on weekends
    { name: 'evening', start: '18:00', end: '23:00' },
    { name: 'night', start: '23:00', end: '08:00' },
  ],
};

/**
 * Determine day type based on day of week and schedule configuration
 */
export async function getDayType(
  dayOfWeek: number = getDayOfWeek()
): Promise<DayType> {
  try {
    await connectToDatabase();

    // Find schedule that includes this day
    const schedule = await Schedule.findOne({
      daysOfWeek: dayOfWeek,
      isActive: true,
    });

    if (schedule) {
      return schedule.dayType;
    }
  } catch (error) {
    console.error('Error fetching schedule:', error);
  }

  // Default fallback
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'weekend';
  }
  if (dayOfWeek === 4 || dayOfWeek === 5) {
    return 'wfh';
  }
  return 'office';
}

/**
 * Determine current time block based on time and day type
 */
export function getCurrentTimeBlock(
  dayType: DayType,
  config: ScheduleConfig = DEFAULT_CONFIG
): TimeBlock {
  const now = getNow(config.timezone);
  const timeBlocks = DEFAULT_TIME_BLOCKS[dayType];

  for (const block of timeBlocks) {
    // Apply buffer to start time (show content earlier)
    const bufferedStart = applyBuffer(block.start, config.bufferMinutes);

    if (isWithinTimeRange(now, bufferedStart, block.end, config.timezone)) {
      return block.name;
    }
  }

  // Default to night if no match
  return 'night';
}

/**
 * Get the current schedule context
 */
export async function getScheduleContext(
  config: ScheduleConfig = DEFAULT_CONFIG
): Promise<ScheduleContext> {
  const now = getNow(config.timezone);
  const dayOfWeek = now.getDay();
  const dayType = await getDayType(dayOfWeek);
  const timeBlock = getCurrentTimeBlock(dayType, config);

  // Get special conditions
  const specialConditions = await getSpecialConditions(dayType, timeBlock);

  return {
    dayType,
    timeBlock,
    date: formatDate(now),
    time: formatTime(now),
    dayOfWeek,
    isHoliday: false,  // TODO: Implement holiday detection
    specialConditions,
  };
}

/**
 * Detect special conditions that affect widget display
 */
async function getSpecialConditions(
  dayType: DayType,
  timeBlock: TimeBlock
): Promise<SpecialCondition[]> {
  const conditions: SpecialCondition[] = [];

  // Import dynamically to avoid circular dependencies
  const { cacheGet, CACHE_KEYS } = await import('@/lib/cache/redis');
  const { isRainExpected } = await import('@/lib/api/weather');
  const { hasSignificantDelays } = await import('@/lib/api/transport');
  const { hasMeetingSoon } = await import('@/lib/api/calendar');

  try {
    // Check weather conditions
    const weather = await cacheGet(CACHE_KEYS.WEATHER);
    if (weather && isRainExpected(weather)) {
      conditions.push({
        type: 'rain_expected',
        severity: 'medium',
        message: 'Rain expected - bring umbrella',
      });
    }

    // Check for hot/cold days
    if (weather?.current) {
      if (weather.current.temperature >= 35) {
        conditions.push({
          type: 'hot_day',
          severity: 'high',
          message: `Hot day: ${weather.current.temperature}°C`,
        });
      } else if (weather.current.temperature <= 10) {
        conditions.push({
          type: 'cold_day',
          severity: 'medium',
          message: `Cold day: ${weather.current.temperature}°C`,
        });
      }
    }

    // Check transit delays (only for office days in morning)
    if (dayType === 'office' && timeBlock === 'morning') {
      const transit = await cacheGet(CACHE_KEYS.TRANSIT);
      if (transit && hasSignificantDelays(transit)) {
        conditions.push({
          type: 'train_delay',
          severity: 'high',
          message: 'Train delays detected',
          data: { departures: transit.departures },
        });
      }
    }

    // Check for upcoming meetings (during workday)
    if (timeBlock === 'workday') {
      const calendar = await cacheGet(CACHE_KEYS.CALENDAR);
      if (calendar) {
        const meeting = hasMeetingSoon(calendar, 30);
        if (meeting) {
          conditions.push({
            type: 'meeting_soon',
            severity: 'medium',
            message: `Meeting in 30 min: ${meeting.title}`,
            data: { event: meeting },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking special conditions:', error);
  }

  return conditions;
}
```

### 4.4 Create Widget Visibility Logic

Create `src/lib/schedule/widgets.ts`:

```typescript
import { WidgetType, DayType, TimeBlock } from '@/types';
import { ScheduleContext, WidgetDisplay, SpecialCondition } from '@/types/schedule';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Schedule, IWidgetConfig } from '@/lib/db/models/schedule';
import { Routine } from '@/lib/db/models/routine';

// Default widget configurations by context
const DEFAULT_WIDGETS: Record<DayType, Record<TimeBlock, WidgetDisplay[]>> = {
  office: {
    morning: [
      { type: 'routine', priority: 1, size: 'medium', config: { category: 'morning' } },
      { type: 'weather', priority: 2, size: 'medium' },
      { type: 'transit', priority: 3, size: 'medium' },
    ],
    workday: [
      { type: 'calendar', priority: 1, size: 'large' },
      { type: 'weather', priority: 2, size: 'small' },
    ],
    evening: [
      { type: 'routine', priority: 1, size: 'medium', config: { category: 'skincare' } },
      { type: 'weather', priority: 2, size: 'small' },
    ],
    night: [
      { type: 'weather', priority: 1, size: 'medium' },
    ],
  },
  wfh: {
    morning: [
      { type: 'weather', priority: 1, size: 'medium' },
      { type: 'calendar', priority: 2, size: 'medium' },
    ],
    workday: [
      { type: 'medication', priority: 1, size: 'small' },
      { type: 'calendar', priority: 2, size: 'large' },
    ],
    evening: [
      { type: 'routine', priority: 1, size: 'medium', config: { category: 'skincare' } },
      { type: 'gaming', priority: 2, size: 'medium' },
    ],
    night: [
      { type: 'weather', priority: 1, size: 'medium' },
    ],
  },
  weekend: {
    morning: [
      { type: 'weather', priority: 1, size: 'medium' },
      { type: 'gaming', priority: 2, size: 'large' },
    ],
    workday: [
      { type: 'weather', priority: 1, size: 'small' },
      { type: 'gaming', priority: 2, size: 'large' },
    ],
    evening: [
      { type: 'gaming', priority: 1, size: 'large' },
      { type: 'routine', priority: 2, size: 'medium', config: { category: 'skincare' } },
    ],
    night: [
      { type: 'weather', priority: 1, size: 'medium' },
    ],
  },
};

/**
 * Get widgets to display for current context
 */
export async function getWidgetsForContext(
  context: ScheduleContext
): Promise<WidgetDisplay[]> {
  let widgets: WidgetDisplay[] = [];

  try {
    await connectToDatabase();

    // Try to get from database first
    const schedule = await Schedule.findOne({
      daysOfWeek: context.dayOfWeek,
      isActive: true,
    });

    if (schedule) {
      const timeBlock = schedule.timeBlocks.find(
        (tb) => tb.name === context.timeBlock
      );

      if (timeBlock?.widgets) {
        widgets = timeBlock.widgets
          .filter((w) => w.enabled)
          .map((w) => ({
            type: w.type,
            priority: w.priority,
            size: getSizeForWidget(w.type, w.priority),
            config: w.config,
          }));
      }
    }
  } catch (error) {
    console.error('Error fetching schedule from database:', error);
  }

  // Fall back to defaults if no database config
  if (widgets.length === 0) {
    widgets = DEFAULT_WIDGETS[context.dayType][context.timeBlock] || [];
  }

  // Apply special condition modifications
  widgets = applySpecialConditions(widgets, context.specialConditions);

  // Sort by priority
  return widgets.sort((a, b) => a.priority - b.priority);
}

/**
 * Determine widget size based on type and priority
 */
function getSizeForWidget(type: WidgetType, priority: number): WidgetDisplay['size'] {
  // Primary widget (priority 1) gets more space
  if (priority === 1) {
    return type === 'gaming' || type === 'calendar' ? 'large' : 'medium';
  }

  // Secondary widgets
  if (priority === 2) {
    return 'medium';
  }

  // Tertiary and below
  return 'small';
}

/**
 * Modify widget list based on special conditions
 */
function applySpecialConditions(
  widgets: WidgetDisplay[],
  conditions: SpecialCondition[]
): WidgetDisplay[] {
  const modified = [...widgets];

  for (const condition of conditions) {
    switch (condition.type) {
      case 'rain_expected':
        // Ensure weather widget is present and visible
        const weatherIdx = modified.findIndex((w) => w.type === 'weather');
        if (weatherIdx >= 0) {
          modified[weatherIdx].priority = 1;  // Bump to top
          modified[weatherIdx].size = 'medium';
        } else {
          modified.unshift({
            type: 'weather',
            priority: 1,
            size: 'medium',
          });
        }
        break;

      case 'train_delay':
        // Ensure transit widget is prominent
        const transitIdx = modified.findIndex((w) => w.type === 'transit');
        if (transitIdx >= 0) {
          modified[transitIdx].priority = 1;
          modified[transitIdx].size = 'large';
        } else {
          modified.unshift({
            type: 'transit',
            priority: 1,
            size: 'large',
          });
        }
        break;

      case 'meeting_soon':
        // Ensure calendar is visible
        const calIdx = modified.findIndex((w) => w.type === 'calendar');
        if (calIdx >= 0) {
          modified[calIdx].priority = Math.min(modified[calIdx].priority, 2);
        }
        break;
    }
  }

  // Re-sort after modifications
  return modified.sort((a, b) => a.priority - b.priority);
}

/**
 * Get routine to display (if any) for current context
 */
export async function getActiveRoutine(
  context: ScheduleContext
): Promise<{ name: string; steps: string[] } | null> {
  try {
    await connectToDatabase();

    // Find matching routine
    const routine = await Routine.findOne({
      isActive: true,
      $or: [
        { 'recurrence.type': 'daily' },
        { 'recurrence.daysOfWeek': context.dayOfWeek },
      ],
      'timeWindow.startTime': { $lte: context.time },
      'timeWindow.endTime': { $gte: context.time },
    });

    if (!routine) {
      return null;
    }

    return {
      name: routine.name,
      steps: routine.steps
        .filter((s) => !s.isOptional)
        .sort((a, b) => a.order - b.order)
        .map((s) => s.title),
    };
  } catch (error) {
    console.error('Error fetching routine:', error);
    return null;
  }
}

/**
 * Check if a specific widget should be shown
 */
export function shouldShowWidget(
  type: WidgetType,
  widgets: WidgetDisplay[]
): boolean {
  return widgets.some((w) => w.type === type);
}

/**
 * Get config for a specific widget
 */
export function getWidgetConfig(
  type: WidgetType,
  widgets: WidgetDisplay[]
): Record<string, unknown> | undefined {
  const widget = widgets.find((w) => w.type === type);
  return widget?.config;
}
```

### 4.5 Create Timing Utilities

Create `src/lib/schedule/timing.ts`:

```typescript
import { ScheduleConfig } from '@/types/schedule';
import { getNow, parseTimeToday, applyBuffer } from '@/lib/utils/date';
import { differenceInMinutes, addMinutes } from 'date-fns';
import { LOCATION, TRMNL } from '@/lib/config';

// Default TRMNL refresh configuration
const DEFAULT_CONFIG: ScheduleConfig = {
  refreshIntervalMinutes: TRMNL.refreshIntervalMinutes,
  bufferMinutes: TRMNL.bufferMinutes,
  timezone: LOCATION.timezone,
};

/**
 * Calculate when the next content transition should occur
 */
export function getNextTransitionTime(
  currentBlockEnd: string,
  config: ScheduleConfig = DEFAULT_CONFIG
): { transitionAt: Date; displayFrom: Date } {
  const now = getNow(config.timezone);
  const transitionAt = parseTimeToday(currentBlockEnd, config.timezone);

  // If transition is in the past, it's tomorrow
  if (transitionAt <= now) {
    transitionAt.setDate(transitionAt.getDate() + 1);
  }

  // Calculate when to start showing next content (with buffer)
  const displayFrom = addMinutes(transitionAt, -config.bufferMinutes);

  return { transitionAt, displayFrom };
}

/**
 * Calculate the optimal refresh schedule
 * Returns times when TRMNL should refresh to catch content changes
 */
export function getOptimalRefreshTimes(
  blockTransitions: string[],  // Array of HH:mm times
  config: ScheduleConfig = DEFAULT_CONFIG
): string[] {
  const refreshTimes: Set<string> = new Set();

  for (const transition of blockTransitions) {
    // Add refresh time with buffer before transition
    const bufferedTime = applyBuffer(transition, config.bufferMinutes);
    refreshTimes.add(bufferedTime);

    // Add one more refresh shortly after transition
    const afterTransition = addMinutes(
      parseTimeToday(transition, config.timezone),
      5
    );
    refreshTimes.add(
      `${String(afterTransition.getHours()).padStart(2, '0')}:${String(afterTransition.getMinutes()).padStart(2, '0')}`
    );
  }

  return Array.from(refreshTimes).sort();
}

/**
 * Check if we're in a transition buffer period
 * (Should show upcoming content instead of current)
 */
export function isInTransitionBuffer(
  nextBlockStart: string,
  config: ScheduleConfig = DEFAULT_CONFIG
): boolean {
  const now = getNow(config.timezone);
  const transitionTime = parseTimeToday(nextBlockStart, config.timezone);
  const bufferStart = addMinutes(transitionTime, -config.bufferMinutes);

  return now >= bufferStart && now < transitionTime;
}

/**
 * Get minutes until next refresh would be useful
 */
export function getMinutesUntilNextUsefulRefresh(
  blockTransitions: string[],
  config: ScheduleConfig = DEFAULT_CONFIG
): number {
  const now = getNow(config.timezone);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let minMinutes = config.refreshIntervalMinutes;  // Default to next scheduled refresh

  for (const transition of blockTransitions) {
    const [h, m] = transition.split(':').map(Number);
    let transitionMinutes = h * 60 + m;

    // Apply buffer
    transitionMinutes -= config.bufferMinutes;
    if (transitionMinutes < 0) transitionMinutes += 24 * 60;

    // Calculate minutes until this transition buffer
    let diff = transitionMinutes - currentMinutes;
    if (diff < 0) diff += 24 * 60;  // Tomorrow

    if (diff > 0 && diff < minMinutes) {
      minMinutes = diff;
    }
  }

  return minMinutes;
}

/**
 * Format remaining time for display
 */
export function formatTimeUntil(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}
```

### 4.6 Create Schedule API Endpoint

Create `src/app/api/schedule/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getScheduleContext } from '@/lib/schedule/context';
import { getWidgetsForContext, getActiveRoutine } from '@/lib/schedule/widgets';

/**
 * GET /api/schedule
 * Returns current schedule context and widgets to display
 */
export async function GET() {
  try {
    // Get current context
    const context = await getScheduleContext();

    // Get widgets for this context
    const widgets = await getWidgetsForContext(context);

    // Get active routine if any
    const routine = await getActiveRoutine(context);

    return NextResponse.json({
      context,
      widgets,
      routine,
      debug: {
        timestamp: new Date().toISOString(),
        widgetCount: widgets.length,
        hasRoutine: !!routine,
        conditionCount: context.specialConditions.length,
      },
    });
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json(
      { error: 'Failed to get schedule', details: String(error) },
      { status: 500 }
    );
  }
}
```

### 4.7 Verify Setup

```bash
# Start the dev server
pnpm dev

# Test schedule endpoint
curl http://localhost:3000/api/schedule
```

Expected response:

```json
{
  "context": {
    "dayType": "office",
    "timeBlock": "workday",
    "date": "2024-01-15",
    "time": "14:30",
    "dayOfWeek": 1,
    "isHoliday": false,
    "specialConditions": []
  },
  "widgets": [
    { "type": "calendar", "priority": 1, "size": "large" },
    { "type": "weather", "priority": 2, "size": "small" }
  ],
  "routine": null,
  "debug": {
    "timestamp": "2024-01-15T14:30:00.000Z",
    "widgetCount": 2,
    "hasRoutine": false,
    "conditionCount": 0
  }
}
```

## Files Created

- `src/types/schedule.ts`
- `src/lib/utils/date.ts`
- `src/lib/schedule/context.ts`
- `src/lib/schedule/widgets.ts`
- `src/lib/schedule/timing.ts`
- `src/app/api/schedule/route.ts`

## Testing Different Contexts

You can test different contexts by modifying the time/date in your system or by temporarily hardcoding values in `getScheduleContext()`:

```typescript
// For testing - override context
const testContext: ScheduleContext = {
  dayType: 'office',
  timeBlock: 'morning',  // Test morning routine
  date: '2024-01-15',
  time: '07:30',
  dayOfWeek: 1,
  isHoliday: false,
  specialConditions: [
    {
      type: 'rain_expected',
      severity: 'medium',
      message: 'Rain expected - bring umbrella',
    },
  ],
};
```

## Next Step

Proceed to [Step 5: Widget System](./05-widget-system.md) to create e-ink optimized widget components.
