# Step 5: Widget System

## Overview

Create e-ink optimized widget components for the TRMNL dashboard. Each widget must adhere to strict constraints: 2-bit grayscale, no gradients, no animations, minimum 2px line thickness, and high contrast.

## E-ink Design Constraints

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Black | `#000000` | Primary text, borders, icons |
| Dark Gray | `#555555` | Secondary text, subtle borders |
| Light Gray | `#AAAAAA` | Muted text, backgrounds |
| White | `#FFFFFF` | Background, inverse text |

### Typography Rules

- Minimum font size: 12px
- Prefer bold weights for important info
- Use Inter font (optimized for screens)
- No anti-aliased small text

### Layout Rules

- Minimum border width: 2px
- No gradients or shadows
- No animations or transitions
- High contrast required (WCAG AAA)

---

## Implementation

### 5.1 Create Base UI Components

Create `src/components/ui/EinkCard.tsx`:

```typescript
import { ReactNode } from 'react';

interface EinkCardProps {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'full';
  variant?: 'default' | 'outlined' | 'filled';
  className?: string;
}

const sizeClasses = {
  small: 'w-[190px] h-[140px]',
  medium: 'w-[390px] h-[140px]',
  large: 'w-[390px] h-[290px]',
  full: 'w-[780px] h-[290px]',
};

const variantClasses = {
  default: 'border-2 border-eink-black bg-eink-white',
  outlined: 'border-2 border-eink-dark bg-eink-white',
  filled: 'border-2 border-eink-black bg-eink-light',
};

export function EinkCard({
  children,
  title,
  icon,
  size = 'medium',
  variant = 'default',
  className = '',
}: EinkCardProps) {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        p-3 overflow-hidden
        ${className}
      `}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-eink-dark">
          {icon && <span className="text-eink-black">{icon}</span>}
          {title && (
            <h3 className="text-eink-sm font-bold text-eink-black uppercase tracking-wide">
              {title}
            </h3>
          )}
        </div>
      )}
      <div className="h-full">{children}</div>
    </div>
  );
}
```

Create `src/components/ui/EinkIcon.tsx`:

```typescript
interface EinkIconProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

// Simple SVG icons optimized for e-ink (2px minimum stroke)
const icons: Record<string, (size: number) => JSX.Element> = {
  sun: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  cloud: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  'cloud-rain': (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    </svg>
  ),
  train: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="3" width="16" height="16" rx="2" />
      <path d="M4 11h16M12 3v8M8 19l-2 3M16 19l2 3" />
      <circle cx="8" cy="15" r="1" fill="currentColor" />
      <circle cx="16" cy="15" r="1" fill="currentColor" />
    </svg>
  ),
  calendar: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  gamepad: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 12h4M8 10v4" />
      <circle cx="17" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
      <path d="M7.5 20A5.5 5.5 0 0 1 2 14.5 5.5 5.5 0 0 1 5.5 9H18.5a5.5 5.5 0 0 1 3.5 5.5 5.5 5.5 0 0 1-5.5 5.5" />
    </svg>
  ),
  steam: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15.8l-2.35-2.35c-.78-.78-.78-2.05 0-2.83s2.05-.78 2.83 0L12 12.14l1.52-1.52c.78-.78 2.05-.78 2.83 0s.78 2.05 0 2.83L14 15.8v6c4.56-.93 8-4.96 8-9.8 0-5.52-4.48-10-10-10z" />
    </svg>
  ),
  xbox: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5L6.5 12 10 7.5 12 10l2-2.5 3.5 4.5L14 16.5 12 14l-2 2.5z" />
    </svg>
  ),
  playstation: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 3v18l3-1.5V3zm6 5.5v10l3-1.5V10zm-9 4v5l3-1.5v-5z" />
    </svg>
  ),
  check: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  alert: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  umbrella: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v20M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12" />
    </svg>
  ),
  clock: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  pill: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.5 3.5a5 5 0 0 1 7.07 0l3.93 3.93a5 5 0 0 1 0 7.07l-7.07 7.07a5 5 0 0 1-7.07 0l-3.93-3.93a5 5 0 0 1 0-7.07z" />
      <line x1="7.5" y1="16.5" x2="16.5" y2="7.5" />
    </svg>
  ),
};

export function EinkIcon({ name, size = 'md', className = '' }: EinkIconProps) {
  const iconSize = sizeMap[size];
  const IconComponent = icons[name];

  if (!IconComponent) {
    // Fallback: empty box
    return (
      <div
        className={`border-2 border-current ${className}`}
        style={{ width: iconSize, height: iconSize }}
      />
    );
  }

  return <span className={className}>{IconComponent(iconSize)}</span>;
}
```

Create `src/components/ui/EinkGrid.tsx`:

```typescript
import { ReactNode } from 'react';

interface EinkGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Grid container for TRMNL dashboard (800x480)
 * Uses a 2-column layout with 10px gaps
 */
export function EinkGrid({ children, className = '' }: EinkGridProps) {
  return (
    <div
      className={`
        w-[800px] h-[480px]
        bg-eink-white
        p-[10px]
        grid grid-cols-2 gap-[10px]
        auto-rows-min
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * Full-width row in the grid
 */
export function EinkGridFullRow({ children }: { children: ReactNode }) {
  return <div className="col-span-2">{children}</div>;
}
```

### 5.2 Create Weather Widget

Create `src/components/widgets/WeatherWidget.tsx`:

```typescript
import { EinkCard } from '@/components/ui/EinkCard';
import { EinkIcon } from '@/components/ui/EinkIcon';
import { WeatherData, WEATHER_CODES } from '@/types/weather';
import { shouldBringUmbrella } from '@/lib/api/weather';

interface WeatherWidgetProps {
  data: WeatherData | null;
  size?: 'small' | 'medium' | 'large';
  showForecast?: boolean;
}

export function WeatherWidget({
  data,
  size = 'medium',
  showForecast = true,
}: WeatherWidgetProps) {
  if (!data) {
    return (
      <EinkCard title="Weather" icon={<EinkIcon name="cloud" size="sm" />} size={size}>
        <div className="flex items-center justify-center h-full text-eink-dark">
          No weather data
        </div>
      </EinkCard>
    );
  }

  const { current, daily } = data;
  const weatherInfo = WEATHER_CODES[current.weatherCode] || { description: 'Unknown', icon: 'cloud' };
  const needsUmbrella = shouldBringUmbrella(data);

  return (
    <EinkCard title="Weather" icon={<EinkIcon name="sun" size="sm" />} size={size}>
      <div className="flex flex-col h-full">
        {/* Current conditions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <EinkIcon name={weatherInfo.icon} size="xl" />
            <div>
              <div className="text-eink-3xl font-bold">{current.temperature}°</div>
              <div className="text-eink-sm text-eink-dark">
                Feels {current.apparentTemperature}°
              </div>
            </div>
          </div>

          {needsUmbrella && (
            <div className="flex items-center gap-1 text-eink-black">
              <EinkIcon name="umbrella" size="md" />
              <span className="text-eink-sm font-bold">BRING</span>
            </div>
          )}
        </div>

        {/* Weather description */}
        <div className="text-eink-base mb-2">{weatherInfo.description}</div>

        {/* Today's high/low */}
        {daily[0] && (
          <div className="flex gap-4 text-eink-sm text-eink-dark">
            <span>H: {daily[0].temperatureMax}°</span>
            <span>L: {daily[0].temperatureMin}°</span>
            {daily[0].precipitationProbability > 0 && (
              <span>Rain: {daily[0].precipitationProbability}%</span>
            )}
          </div>
        )}

        {/* 3-day forecast (if space) */}
        {showForecast && size !== 'small' && (
          <div className="mt-auto pt-2 border-t-2 border-eink-light">
            <div className="flex justify-between">
              {daily.slice(1, 4).map((day, i) => (
                <div key={i} className="text-center">
                  <div className="text-eink-xs text-eink-dark">
                    {new Date(day.date).toLocaleDateString('en-AU', { weekday: 'short' })}
                  </div>
                  <div className="text-eink-sm font-bold">
                    {day.temperatureMax}°/{day.temperatureMin}°
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </EinkCard>
  );
}
```

### 5.3 Create Transit Widget

Create `src/components/widgets/TransitWidget.tsx`:

```typescript
import { EinkCard } from '@/components/ui/EinkCard';
import { EinkIcon } from '@/components/ui/EinkIcon';
import { TransitData, TRAIN_LINES } from '@/types/transport';
import { formatDelay } from '@/lib/api/transport';

interface TransitWidgetProps {
  data: TransitData | null;
  size?: 'small' | 'medium' | 'large';
  limit?: number;
}

export function TransitWidget({
  data,
  size = 'medium',
  limit = 4,
}: TransitWidgetProps) {
  if (!data) {
    return (
      <EinkCard title="Trains" icon={<EinkIcon name="train" size="sm" />} size={size}>
        <div className="flex items-center justify-center h-full text-eink-dark">
          No transit data
        </div>
      </EinkCard>
    );
  }

  const departures = data.departures.slice(0, limit);
  const hasDelays = departures.some((d) => d.status === 'delayed');

  return (
    <EinkCard
      title={data.stationName}
      icon={<EinkIcon name="train" size="sm" />}
      size={size}
      variant={hasDelays ? 'filled' : 'default'}
    >
      <div className="flex flex-col gap-2">
        {departures.length === 0 ? (
          <div className="text-eink-dark text-eink-sm">No upcoming departures</div>
        ) : (
          departures.map((dep, i) => {
            const lineInfo = TRAIN_LINES[dep.routeShortName];
            const departureTime = new Date(dep.estimatedTime || dep.scheduledTime);
            const timeStr = departureTime.toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });

            return (
              <div
                key={i}
                className={`
                  flex items-center justify-between
                  ${i < departures.length - 1 ? 'pb-2 border-b border-eink-light' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  {/* Line indicator */}
                  <div
                    className="
                      w-8 h-6 flex items-center justify-center
                      border-2 border-eink-black font-bold text-eink-xs
                    "
                  >
                    {dep.routeShortName}
                  </div>
                  {/* Destination */}
                  <div className="text-eink-sm truncate max-w-[180px]">
                    {dep.headsign}
                  </div>
                </div>

                {/* Time and status */}
                <div className="flex items-center gap-2">
                  <span className="text-eink-lg font-bold">{timeStr}</span>
                  {dep.status === 'delayed' && (
                    <span className="text-eink-xs border-2 border-eink-black px-1">
                      {formatDelay(dep.delaySeconds)}
                    </span>
                  )}
                  {dep.status === 'cancelled' && (
                    <span className="text-eink-xs bg-eink-black text-eink-white px-1">
                      CANC
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </EinkCard>
  );
}
```

### 5.4 Create Calendar Widget

Create `src/components/widgets/CalendarWidget.tsx`:

```typescript
import { EinkCard } from '@/components/ui/EinkCard';
import { EinkIcon } from '@/components/ui/EinkIcon';
import { CalendarData, CalendarEvent } from '@/types/calendar';
import { formatEventTime, getTodayEvents, getUpcomingEvents } from '@/lib/api/calendar';

interface CalendarWidgetProps {
  data: CalendarData | null;
  size?: 'small' | 'medium' | 'large';
  mode?: 'today' | 'upcoming';
}

export function CalendarWidget({
  data,
  size = 'medium',
  mode = 'today',
}: CalendarWidgetProps) {
  if (!data) {
    return (
      <EinkCard title="Calendar" icon={<EinkIcon name="calendar" size="sm" />} size={size}>
        <div className="flex items-center justify-center h-full text-eink-dark">
          No calendar data
        </div>
      </EinkCard>
    );
  }

  const events = mode === 'today'
    ? getTodayEvents(data)
    : getUpcomingEvents(data, 8);

  const limitedEvents = size === 'large' ? events.slice(0, 6) : events.slice(0, 3);

  return (
    <EinkCard
      title={mode === 'today' ? "Today's Events" : 'Upcoming'}
      icon={<EinkIcon name="calendar" size="sm" />}
      size={size}
    >
      <div className="flex flex-col gap-2">
        {limitedEvents.length === 0 ? (
          <div className="text-eink-dark text-eink-sm">
            {mode === 'today' ? 'No events today' : 'No upcoming events'}
          </div>
        ) : (
          limitedEvents.map((event, i) => (
            <EventRow key={event.id} event={event} isLast={i === limitedEvents.length - 1} />
          ))
        )}

        {events.length > limitedEvents.length && (
          <div className="text-eink-xs text-eink-dark mt-1">
            +{events.length - limitedEvents.length} more
          </div>
        )}
      </div>
    </EinkCard>
  );
}

function EventRow({ event, isLast }: { event: CalendarEvent; isLast: boolean }) {
  const now = new Date();
  const startTime = new Date(event.startTime);
  const isNow = !event.isAllDay && startTime <= now && new Date(event.endTime) > now;
  const isSoon = !event.isAllDay && startTime > now &&
    (startTime.getTime() - now.getTime()) < 30 * 60 * 1000;
 
  return (
    <div
      className={`
        flex gap-2
        ${!isLast ? 'pb-2 border-b border-eink-light' : ''}
        ${isNow ? 'bg-eink-light -mx-2 px-2 py-1' : ''}
      `}
    >
      {/* Time column */}
      <div className="w-16 shrink-0"> 
        {event.isAllDay ? (
          <span className="text-eink-xs text-eink-dark">All day</span>
        ) : (
          <span className={`text-eink-sm ${isSoon ? 'font-bold' : ''}`}>
            {startTime.toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        )} 
      </div>

      {/* Event details */}
      <div className="flex-1 min-w-0">
        <div className={`text-eink-sm truncate ${isNow ? 'font-bold' : ''}`}>
          {event.title}
        </div>
        {event.location && (
          <div className="text-eink-xs text-eink-dark truncate">
            @ {event.location}
          </div>
        )}
      </div>

      {/* Status indicators */}
      {isNow && (
        <div className="shrink-0 text-eink-xs border-2 border-eink-black px-1 h-fit">
          NOW
        </div>
      )}
      {isSoon && !isNow && (
        <div className="shrink-0 text-eink-xs text-eink-dark">
          Soon
        </div>
      )}
    </div>
  );
}
```

### 5.5 Create Gaming Widget

Create `src/components/widgets/GamingWidget.tsx`:

```typescript
import { EinkCard } from '@/components/ui/EinkCard';
import { EinkIcon } from '@/components/ui/EinkIcon';
import { GamingData, RecentGame } from '@/types/gaming';
import { formatPlaytime, getPlatformIcon } from '@/lib/api/gaming';

interface GamingWidgetProps {
  data: GamingData | null;
  size?: 'small' | 'medium' | 'large';
  limit?: number;
}

export function GamingWidget({
  data,
  size = 'medium',
  limit = 3,
}: GamingWidgetProps) {
  if (!data) {
    return (
      <EinkCard title="Gaming" icon={<EinkIcon name="gamepad" size="sm" />} size={size}>
        <div className="flex items-center justify-center h-full text-eink-dark">
          No gaming data
        </div>
      </EinkCard>
    );
  }

  const games = data.allRecentGames.slice(0, size === 'large' ? limit + 2 : limit);

  return (
    <EinkCard title="Recently Played" icon={<EinkIcon name="gamepad" size="sm" />} size={size}>
      <div className="flex flex-col gap-2">
        {games.length === 0 ? (
          <div className="text-eink-dark text-eink-sm">No recent games</div>
        ) : (
          games.map((game, i) => (
            <GameRow key={`${game.platform}-${game.gameId}`} game={game} isLast={i === games.length - 1} />
          ))
        )}
      </div>
    </EinkCard>
  );
}

function GameRow({ game, isLast }: { game: RecentGame; isLast: boolean }) {
  const hasAchievements = game.achievementsEarned !== undefined &&
    game.achievementsTotal !== undefined;
  const achievementPercent = hasAchievements
    ? Math.round((game.achievementsEarned! / game.achievementsTotal!) * 100)
    : null;

  return (
    <div
      className={`
        flex items-center gap-2
        ${!isLast ? 'pb-2 border-b border-eink-light' : ''}
      `}
    >
      {/* Platform icon */}
      <EinkIcon name={getPlatformIcon(game.platform)} size="sm" className="shrink-0" />  

      {/* Game info */}
      <div className="flex-1 min-w-0">
        <div className="text-eink-sm font-medium truncate">{game.title}</div>
        <div className="flex gap-2 text-eink-xs text-eink-dark">
          {game.playtimeRecent && (
            <span>{formatPlaytime(game.playtimeRecent)} recent</span>
          )}
          {game.playtimeTotal && !game.playtimeRecent && (
            <span>{formatPlaytime(game.playtimeTotal)} total</span>
          )}
        </div>
      </div>

      {/* Achievement progress */}
      {achievementPercent !== null && (
        <div className="shrink-0 flex items-center gap-1">
          <div className="w-12 h-2 border border-eink-dark">
            <div
              className="h-full bg-eink-black"
              style={{ width: `${achievementPercent}%` }}
            />
          </div>
          <span className="text-eink-xs">{achievementPercent}%</span>
        </div>
      )}
    </div>
  );
}
```

### 5.6 Create Routine Widget

Create `src/components/widgets/RoutineWidget.tsx`:

```typescript
import { EinkCard } from '@/components/ui/EinkCard';
import { EinkIcon } from '@/components/ui/EinkIcon';

interface RoutineStep {
  title: string;
  description?: string;
  duration?: number;
  completed?: boolean;
}

interface RoutineWidgetProps {
  name: string;
  steps: RoutineStep[];
  size?: 'small' | 'medium' | 'large';
  category?: 'morning' | 'evening' | 'skincare' | 'medication' | 'custom';
}

const categoryIcons = {
  morning: 'sun',
  evening: 'clock',
  skincare: 'check',
  medication: 'pill',
  custom: 'check',
};

export function RoutineWidget({
  name,
  steps,
  size = 'medium',
  category = 'custom',
}: RoutineWidgetProps) {
  const icon = categoryIcons[category];
  const displaySteps = size === 'small' ? steps.slice(0, 3) : steps;

  return (
    <EinkCard title={name} icon={<EinkIcon name={icon} size="sm" />} size={size}>
      <div className="flex flex-col gap-1">
        {displaySteps.map((step, i) => (
          <div
            key={i}
            className={`
              flex items-start gap-2
              ${i < displaySteps.length - 1 ? 'pb-1' : ''}
            `}
          >
            {/* Step number or checkbox */}
            <div
              className={`
                w-5 h-5 flex items-center justify-center shrink-0
                border-2 border-eink-black text-eink-xs font-bold
                ${step.completed ? 'bg-eink-black text-eink-white' : ''}
              `}
            >
              {step.completed ? '✓' : i + 1}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div
                className={`
                  text-eink-sm
                  ${step.completed ? 'line-through text-eink-dark' : ''}
                `}
              >
                {step.title}
              </div>
              {step.description && size !== 'small' && (
                <div className="text-eink-xs text-eink-dark truncate">
                  {step.description}
                </div>
              )}
            </div>

            {/* Duration */}
            {step.duration && size !== 'small' && (
              <div className="text-eink-xs text-eink-dark shrink-0">
                {step.duration}m
              </div>
            )}
          </div>
        ))}

        {steps.length > displaySteps.length && (
          <div className="text-eink-xs text-eink-dark mt-1">
            +{steps.length - displaySteps.length} more steps
          </div>
        )}
      </div>
    </EinkCard>
  );
}
```

### 5.7 Create Medication Widget

Create `src/components/widgets/MedicationWidget.tsx`:

```typescript
import { EinkCard } from '@/components/ui/EinkCard';
import { EinkIcon } from '@/components/ui/EinkIcon';

interface MedicationWidgetProps {
  medications: Array<{
    name: string;
    dosage?: string;
    time?: string;
    taken?: boolean;
    notes?: string;
  }>;
  size?: 'small' | 'medium';
}

export function MedicationWidget({
  medications,
  size = 'small',
}: MedicationWidgetProps) {
  const pendingCount = medications.filter((m) => !m.taken).length;

  return (
    <EinkCard
      title="Medication"
      icon={<EinkIcon name="pill" size="sm" />}
      size={size}
      variant={pendingCount > 0 ? 'filled' : 'default'}
    >
      <div className="flex flex-col gap-2">
        {medications.length === 0 ? (
          <div className="text-eink-dark text-eink-sm">No medications scheduled</div>
        ) : (
          medications.map((med, i) => (
            <div
              key={i}
              className={`
                flex items-center gap-2
                ${i < medications.length - 1 ? 'pb-2 border-b border-eink-light' : ''}
              `}
            >
              {/* Status indicator */}
              <div
                className={`
                  w-5 h-5 flex items-center justify-center shrink-0
                  border-2 border-eink-black
                  ${med.taken ? 'bg-eink-black' : ''}
                `}
              >
                {med.taken && <EinkIcon name="check" size="sm" className="text-eink-white" />}
              </div>

              {/* Medication info */}
              <div className="flex-1 min-w-0">
                <div
                  className={`
                    text-eink-sm font-medium
                    ${med.taken ? 'line-through text-eink-dark' : ''}
                  `}
                >
                  {med.name}
                </div>
                {med.dosage && (
                  <div className="text-eink-xs text-eink-dark">{med.dosage}</div>
                )}
              </div>

              {/* Time */}
              {med.time && !med.taken && (
                <div className="text-eink-sm font-bold shrink-0">{med.time}</div>
              )}
            </div>
          ))
        )}

        {pendingCount > 0 && (
          <div className="mt-1 p-2 border-2 border-eink-black text-center">
            <span className="text-eink-sm font-bold">
              {pendingCount} remaining
            </span>
          </div>
        )}
      </div>
    </EinkCard>
  );
}
```

### 5.8 Create Alert Banner Component

Create `src/components/widgets/AlertBanner.tsx`:

```typescript
import { EinkIcon } from '@/components/ui/EinkIcon';
import { SpecialCondition } from '@/types/schedule';

interface AlertBannerProps {
  conditions: SpecialCondition[];
}

const conditionIcons: Record<SpecialCondition['type'], string> = {
  rain_expected: 'umbrella',
  train_delay: 'alert',
  hot_day: 'sun',
  cold_day: 'cloud',
  meeting_soon: 'calendar',
};

export function AlertBanner({ conditions }: AlertBannerProps) {
  if (conditions.length === 0) return null;

  // Only show high and medium severity
  const importantConditions = conditions.filter(
    (c) => c.severity === 'high' || c.severity === 'medium'
  );

  if (importantConditions.length === 0) return null;

  return (
    <div className="w-full bg-eink-black text-eink-white p-2 flex items-center gap-3">
      <EinkIcon name="alert" size="md" className="shrink-0" />
      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
        {importantConditions.map((condition, i) => (
          <div key={i} className="flex items-center gap-1">
            <EinkIcon
              name={conditionIcons[condition.type]}
              size="sm"
              className="opacity-80"
            />
            <span className="text-eink-sm">{condition.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.9 Create Widget Export Index

Create `src/components/widgets/index.ts`:

```typescript
export { WeatherWidget } from './WeatherWidget';
export { TransitWidget } from './TransitWidget';
export { CalendarWidget } from './CalendarWidget';
export { GamingWidget } from './GamingWidget';
export { RoutineWidget } from './RoutineWidget';
export { MedicationWidget } from './MedicationWidget';
export { AlertBanner } from './AlertBanner';
```

### 5.10 Verify Setup

```bash
# Start the dev server
pnpm dev

# Type check
pnpm type-check
```

Visit <http://localhost:3000> and use browser dev tools to set viewport to 800x480.

## Files Created

- `src/components/ui/EinkCard.tsx`
- `src/components/ui/EinkIcon.tsx`
- `src/components/ui/EinkGrid.tsx`
- `src/components/widgets/WeatherWidget.tsx`
- `src/components/widgets/TransitWidget.tsx`
- `src/components/widgets/CalendarWidget.tsx`
- `src/components/widgets/GamingWidget.tsx`
- `src/components/widgets/RoutineWidget.tsx`
- `src/components/widgets/MedicationWidget.tsx`
- `src/components/widgets/AlertBanner.tsx`
- `src/components/widgets/index.ts`

## Widget Size Reference

| Size | Dimensions | Fits | Best For |
|------|------------|------|----------|
| small | 190×140px | 4 per row | Simple info, stats |
| medium | 390×140px | 2 per row | Lists with 3-4 items |
| large | 390×290px | 2 per column | Detailed lists, primary info |
| full | 780×290px | Full width | Primary focus widget |

## E-ink Testing Tips

1. **Contrast Check**: Take a screenshot and convert to grayscale
2. **Squint Test**: If you squint, can you still read it?
3. **2-bit Preview**: Use image editor to reduce to 4 colors
4. **Viewport Test**: Browser DevTools → 800×480

## Next Step

Proceed to [Step 6: Dashboard Renderer](./06-dashboard-renderer.md) to create the main TRMNL-compatible page.
