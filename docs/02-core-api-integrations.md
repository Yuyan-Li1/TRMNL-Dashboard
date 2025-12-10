# Step 2: Core API Integrations

## Overview

Set up the core APIs that provide essential dashboard data: weather (Open-Meteo), public transit (Transport NSW), and calendar (Google Calendar).

## ⚠️ MANUAL ACTION REQUIRED

### 2.1 Transport NSW API Key

1. Go to <https://opendata.transport.nsw.gov.au>
2. Create an account and verify your email
3. Go to "My Applications" and create a new application
4. Select the following APIs:
   - **Public Transport - Realtime Trip Update** (GTFS-realtime)
   - **Public Transport - Departures** (optional, for simpler queries)
5. Copy your API key

**Save this value:**

```text
TFNSW_API_KEY=your-api-key-here
```

### 2.2 Google Cloud Service Account

1. Go to <https://console.cloud.google.com>
2. Create a new project called "trmnl-dashboard"
3. Enable the **Google Calendar API**:
   - Go to APIs & Services → Library
   - Search for "Google Calendar API"
   - Click Enable
4. Create a Service Account:
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "Service Account"
   - Name: `trmnl-calendar`
   - Role: None needed (we'll share the calendar directly)
   - Click "Done"
5. Create a key for the service account:
   - Click on the service account you created
   - Go to "Keys" tab
   - Add Key → Create new key → JSON
   - Save the downloaded JSON file securely
6. Share your calendar with the service account:
   - Open Google Calendar
   - Find the calendar you want to use
   - Click the three dots → Settings and sharing
   - Under "Share with specific people", add the service account email
   - Permission: "See all event details"
7. Get your Calendar ID:
   - In calendar settings, scroll to "Integrate calendar"
   - Copy the Calendar ID (usually your email for primary calendar)

**Save these values:**

```text
GOOGLE_CLIENT_EMAIL=trmnl-calendar@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your-email@gmail.com
```

**Note:** When adding `GOOGLE_PRIVATE_KEY` to `.env.local`, keep the `\n` characters and wrap in quotes.

---

## Implementation

### 2.3 Create Weather Types

Create `src/types/weather.ts`:

```typescript
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  isDay: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  fetchedAt: string;
}

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs
export const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: 'sun' },
  1: { description: 'Mainly clear', icon: 'sun' },
  2: { description: 'Partly cloudy', icon: 'cloud-sun' },
  3: { description: 'Overcast', icon: 'cloud' },
  45: { description: 'Fog', icon: 'fog' },
  48: { description: 'Depositing rime fog', icon: 'fog' },
  51: { description: 'Light drizzle', icon: 'cloud-drizzle' },
  53: { description: 'Moderate drizzle', icon: 'cloud-drizzle' },
  55: { description: 'Dense drizzle', icon: 'cloud-drizzle' },
  61: { description: 'Slight rain', icon: 'cloud-rain' },
  63: { description: 'Moderate rain', icon: 'cloud-rain' },
  65: { description: 'Heavy rain', icon: 'cloud-rain' },
  71: { description: 'Slight snow', icon: 'snowflake' },
  73: { description: 'Moderate snow', icon: 'snowflake' },
  75: { description: 'Heavy snow', icon: 'snowflake' },
  80: { description: 'Slight rain showers', icon: 'cloud-showers' },
  81: { description: 'Moderate rain showers', icon: 'cloud-showers' },
  82: { description: 'Violent rain showers', icon: 'cloud-showers' },
  95: { description: 'Thunderstorm', icon: 'cloud-bolt' },
  96: { description: 'Thunderstorm with hail', icon: 'cloud-bolt' },
  99: { description: 'Thunderstorm with heavy hail', icon: 'cloud-bolt' },
};
```

### 2.4 Create Weather API Client

Create `src/lib/api/weather.ts`:

```typescript
import { WeatherData, CurrentWeather, HourlyForecast, DailyForecast } from '@/types/weather';
import { cacheGet, cacheSet, CACHE_TTL, CACHE_KEYS } from '@/lib/cache/redis';

// Sydney coordinates (change for your location)
const LATITUDE = -33.8688;
const LONGITUDE = 151.2093;
const TIMEZONE = 'Australia/Sydney';

// Open-Meteo API base URL (no auth required!)
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
  };
}

/**
 * Fetch weather data from Open-Meteo API
 * Rate limit: 10,000 requests/day (no auth required)
 */
async function fetchWeatherFromAPI(): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: LATITUDE.toString(),
    longitude: LONGITUDE.toString(),
    timezone: TIMEZONE,
    // Current weather
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'is_day',
    ].join(','),
    // Hourly forecast (next 24 hours)
    hourly: [
      'temperature_2m',
      'precipitation',
      'precipitation_probability',
      'weather_code',
    ].join(','),
    forecast_hours: '24',
    // Daily forecast (7 days)
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'weather_code',
      'sunrise',
      'sunset',
    ].join(','),
  });

  const response = await fetch(`${BASE_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();

  // Transform to our format
  const current: CurrentWeather = {
    temperature: Math.round(data.current.temperature_2m),
    apparentTemperature: Math.round(data.current.apparent_temperature),
    humidity: data.current.relative_humidity_2m,
    precipitation: data.current.precipitation,
    weatherCode: data.current.weather_code,
    windSpeed: Math.round(data.current.wind_speed_10m),
    isDay: data.current.is_day === 1,
  };

  const hourly: HourlyForecast[] = data.hourly.time.map((time, i) => ({
    time,
    temperature: Math.round(data.hourly.temperature_2m[i]),
    precipitation: data.hourly.precipitation[i],
    precipitationProbability: data.hourly.precipitation_probability[i],
    weatherCode: data.hourly.weather_code[i],
  }));

  const daily: DailyForecast[] = data.daily.time.map((date, i) => ({
    date,
    temperatureMax: Math.round(data.daily.temperature_2m_max[i]),
    temperatureMin: Math.round(data.daily.temperature_2m_min[i]),
    precipitationSum: data.daily.precipitation_sum[i],
    precipitationProbability: data.daily.precipitation_probability_max[i],
    weatherCode: data.daily.weather_code[i],
    sunrise: data.daily.sunrise[i],
    sunset: data.daily.sunset[i],
  }));

  return {
    current,
    hourly,
    daily,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Get weather data (with caching)
 */
export async function getWeather(): Promise<WeatherData> {
  // Try cache first
  const cached = await cacheGet<WeatherData>(CACHE_KEYS.WEATHER);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchWeatherFromAPI();

  // Cache for 15 minutes
  await cacheSet(CACHE_KEYS.WEATHER, data, CACHE_TTL.WEATHER);

  return data;
}

/**
 * Check if rain is expected in the next few hours
 */
export function isRainExpected(weather: WeatherData, hoursAhead: number = 3): boolean {
  const upcoming = weather.hourly.slice(0, hoursAhead);
  return upcoming.some(
    (h) => h.precipitationProbability > 30 || h.precipitation > 0
  );
}

/**
 * Get umbrella recommendation based on weather
 */
export function shouldBringUmbrella(weather: WeatherData): boolean {
  // Check today's forecast
  const today = weather.daily[0];
  if (today.precipitationProbability > 40 || today.precipitationSum > 1) {
    return true;
  }

  // Check next 12 hours
  const next12Hours = weather.hourly.slice(0, 12);
  return next12Hours.some((h) => h.precipitationProbability > 50);
}
```

### 2.5 Create Transport Types

Create `src/types/transport.ts`:

```typescript
export interface StopDeparture {
  tripId: string;
  routeId: string;
  routeShortName: string;  // e.g., "T1", "T2"
  headsign: string;        // e.g., "City via Central"
  scheduledTime: string;   // ISO timestamp
  estimatedTime?: string;  // ISO timestamp if realtime available
  delaySeconds: number;    // Positive = late, negative = early
  platform?: string;
  status: 'on_time' | 'delayed' | 'early' | 'cancelled';
}

export interface TransitData {
  stationName: string;
  stationId: string;
  departures: StopDeparture[];
  fetchedAt: string;
}

// Sydney Trains line colors (for reference)
export const TRAIN_LINES: Record<string, { name: string; color: string }> = {
  T1: { name: 'North Shore & Western', color: '#F99D1C' },
  T2: { name: 'Inner West & Leppington', color: '#0098CD' },
  T3: { name: 'Bankstown', color: '#F37021' },
  T4: { name: 'Eastern Suburbs & Illawarra', color: '#005AA3' },
  T5: { name: 'Cumberland', color: '#C4258F' },
  T7: { name: 'Olympic Park', color: '#6F818E' },
  T8: { name: 'Airport & South', color: '#00954C' },
  T9: { name: 'Northern', color: '#D11F2F' },
};
```

### 2.6 Create Transport API Client

Create `src/lib/api/transport.ts`:

```typescript
import { transit_realtime } from 'gtfs-realtime-bindings';
import { TransitData, StopDeparture } from '@/types/transport';
import { cacheGet, cacheSet, CACHE_TTL, CACHE_KEYS } from '@/lib/cache/redis';

const TFNSW_API_KEY = process.env.TFNSW_API_KEY;

// Transport NSW API endpoints
const GTFS_REALTIME_URL = 'https://api.transport.nsw.gov.au/v2/gtfs/realtime/sydneytrains';

// Lidcombe station stop ID (change for your station)
// Find stop IDs from GTFS static data or TfNSW documentation
const LIDCOMBE_STOP_ID = '2148102';  // Platform 1 - City direction

// Bondi Junction station stop ID (for filtering)
const BONDI_JUNCTION_STOP_ID = '2000270';

interface StaticStopTime {
  tripId: string;
  stopId: string;
  arrivalTime: string;
  departureTime: string;
  stopSequence: number;
}

/**
 * Fetch GTFS realtime data from Transport NSW
 * Rate limit: 60,000 requests/day
 */
async function fetchGTFSRealtime(): Promise<transit_realtime.FeedMessage> {
  if (!TFNSW_API_KEY) {
    throw new Error('TFNSW_API_KEY not configured');
  }

  const response = await fetch(GTFS_REALTIME_URL, {
    headers: {
      Authorization: `apikey ${TFNSW_API_KEY}`,
      Accept: 'application/x-google-protobuf',
    },
  });

  if (!response.ok) {
    throw new Error(`TfNSW API error: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
}

/**
 * Parse delay status from seconds
 */
function getDelayStatus(delaySeconds: number): StopDeparture['status'] {
  if (delaySeconds <= -60) return 'early';
  if (delaySeconds >= 300) return 'delayed';  // 5+ minutes late
  return 'on_time';
}

/**
 * Format delay for display
 */
export function formatDelay(delaySeconds: number): string {
  if (Math.abs(delaySeconds) < 60) return 'On time';
  const minutes = Math.round(delaySeconds / 60);
  if (minutes > 0) return `${minutes} min late`;
  return `${Math.abs(minutes)} min early`;
}

/**
 * Get upcoming departures from a station
 */
async function fetchDepartures(
  stopId: string,
  limit: number = 5
): Promise<StopDeparture[]> {
  const feed = await fetchGTFSRealtime();
  const departures: StopDeparture[] = [];

  // Process trip updates
  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue;

    const tripUpdate = entity.tripUpdate;
    const trip = tripUpdate.trip;

    // Find stop time update for our station
    const stopTimeUpdate = tripUpdate.stopTimeUpdate?.find(
      (stu) => stu.stopId === stopId
    );

    if (!stopTimeUpdate) continue;

    // Get delay information
    const departure = stopTimeUpdate.departure || stopTimeUpdate.arrival;
    if (!departure) continue;

    const delaySeconds = departure.delay || 0;
    const scheduledTime = new Date((departure.time as number) * 1000 - delaySeconds * 1000);
    const estimatedTime = new Date((departure.time as number) * 1000);

    departures.push({
      tripId: trip?.tripId || '',
      routeId: trip?.routeId || '',
      routeShortName: extractLineName(trip?.routeId || ''),
      headsign: extractHeadsign(trip?.tripId || ''),
      scheduledTime: scheduledTime.toISOString(),
      estimatedTime: estimatedTime.toISOString(),
      delaySeconds,
      status: getDelayStatus(delaySeconds),
    });
  }

  // Sort by estimated time and limit results
  return departures
    .sort((a, b) => {
      const timeA = new Date(a.estimatedTime || a.scheduledTime).getTime();
      const timeB = new Date(b.estimatedTime || b.scheduledTime).getTime();
      return timeA - timeB;
    })
    .slice(0, limit);
}

/**
 * Extract line name from route ID
 * TfNSW route IDs follow patterns like "SYD-T1-..."
 */
function extractLineName(routeId: string): string {
  const match = routeId.match(/T\d/);
  return match ? match[0] : 'Train';
}

/**
 * Extract headsign from trip ID
 * This is a simplified version - real implementation would use static GTFS data
 */
function extractHeadsign(tripId: string): string {
  // In production, look up from static GTFS data
  if (tripId.includes('City') || tripId.includes('BJ')) {
    return 'City via Central';
  }
  return 'Check timetable';
}

/**
 * Get transit data with caching
 */
export async function getTransitDepartures(
  stopId: string = LIDCOMBE_STOP_ID
): Promise<TransitData> {
  const cacheKey = `${CACHE_KEYS.TRANSIT}:${stopId}`;

  // Try cache first
  const cached = await cacheGet<TransitData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const departures = await fetchDepartures(stopId);

  const data: TransitData = {
    stationName: 'Lidcombe',  // Customize for your station
    stationId: stopId,
    departures,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 5 minutes
  await cacheSet(cacheKey, data, CACHE_TTL.TRANSIT);

  return data;
}

/**
 * Check if any trains are significantly delayed
 */
export function hasSignificantDelays(transit: TransitData): boolean {
  return transit.departures.some((d) => d.delaySeconds >= 600);  // 10+ minutes
}

/**
 * Get the next train to a specific destination
 */
export function getNextTrainTo(
  transit: TransitData,
  destinationPattern: string
): StopDeparture | null {
  return transit.departures.find(
    (d) => d.headsign.toLowerCase().includes(destinationPattern.toLowerCase())
  ) || null;
}
```

### 2.7 Create Calendar Types

Create `src/types/calendar.ts`:

```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;  // ISO timestamp
  endTime: string;    // ISO timestamp
  isAllDay: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  colorId?: string;
}

export interface CalendarData {
  calendarName: string;
  events: CalendarEvent[];
  fetchedAt: string;
}

// Google Calendar color IDs to hex colors
export const CALENDAR_COLORS: Record<string, string> = {
  '1': '#7986CB',   // Lavender
  '2': '#33B679',   // Sage
  '3': '#8E24AA',   // Grape
  '4': '#E67C73',   // Flamingo
  '5': '#F6BF26',   // Banana
  '6': '#F4511E',   // Tangerine
  '7': '#039BE5',   // Peacock
  '8': '#616161',   // Graphite
  '9': '#3F51B5',   // Blueberry
  '10': '#0B8043',  // Basil
  '11': '#D50000',  // Tomato
};
```

### 2.8 Create Calendar API Client

Create `src/lib/api/calendar.ts`:

```typescript
import { google } from 'googleapis';
import { CalendarData, CalendarEvent } from '@/types/calendar';
import { cacheGet, cacheSet, CACHE_TTL, CACHE_KEYS } from '@/lib/cache/redis';

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

/**
 * Get authenticated Google Calendar client
 */
function getCalendarClient() {
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
    throw new Error('Google Calendar credentials not configured');
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  return google.calendar({ version: 'v3', auth });
}

/**
 * Fetch events from Google Calendar
 */
async function fetchEventsFromAPI(daysAhead: number = 7): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient();

  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  const response = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin: now.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const events = response.data.items || [];

  return events.map((event): CalendarEvent => {
    const isAllDay = !event.start?.dateTime;

    return {
      id: event.id || '',
      title: event.summary || 'Untitled Event',
      description: event.description,
      location: event.location,
      startTime: event.start?.dateTime || event.start?.date || '',
      endTime: event.end?.dateTime || event.end?.date || '',
      isAllDay,
      status: (event.status as CalendarEvent['status']) || 'confirmed',
      colorId: event.colorId,
    };
  });
}

/**
 * Get calendar events with caching
 */
export async function getCalendarEvents(daysAhead: number = 7): Promise<CalendarData> {
  // Try cache first
  const cached = await cacheGet<CalendarData>(CACHE_KEYS.CALENDAR);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const events = await fetchEventsFromAPI(daysAhead);

  const data: CalendarData = {
    calendarName: GOOGLE_CALENDAR_ID || 'Calendar',
    events,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 10 minutes
  await cacheSet(CACHE_KEYS.CALENDAR, data, CACHE_TTL.CALENDAR);

  return data;
}

/**
 * Get today's events
 */
export function getTodayEvents(calendar: CalendarData): CalendarEvent[] {
  const today = new Date().toISOString().split('T')[0];

  return calendar.events.filter((event) => {
    const eventDate = event.startTime.split('T')[0];
    return eventDate === today;
  });
}

/**
 * Get upcoming events in the next N hours
 */
export function getUpcomingEvents(
  calendar: CalendarData,
  hoursAhead: number = 4
): CalendarEvent[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return calendar.events.filter((event) => {
    const startTime = new Date(event.startTime);
    return startTime >= now && startTime <= cutoff;
  });
}

/**
 * Check if there's a meeting soon
 */
export function hasMeetingSoon(
  calendar: CalendarData,
  minutesAhead: number = 30
): CalendarEvent | null {
  const now = new Date();
  const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

  return calendar.events.find((event) => {
    if (event.isAllDay) return false;
    const startTime = new Date(event.startTime);
    return startTime >= now && startTime <= cutoff;
  }) || null;
}

/**
 * Format event time for display
 */
export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return 'All day';

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  return `${start.toLocaleTimeString('en-AU', timeFormat)} - ${end.toLocaleTimeString('en-AU', timeFormat)}`;
}
```

### 2.9 Create Combined Data Fetcher

Create `src/lib/api/refresh.ts`:

```typescript
import { getWeather } from './weather';
import { getTransitDepartures } from './transport';
import { getCalendarEvents } from './calendar';
import { WeatherData } from '@/types/weather';
import { TransitData } from '@/types/transport';
import { CalendarData } from '@/types/calendar';
import { cacheSet, CACHE_KEYS } from '@/lib/cache/redis';

export interface DashboardData {
  weather: WeatherData | null;
  transit: TransitData | null;
  calendar: CalendarData | null;
  errors: string[];
  refreshedAt: string;
}

/**
 * Refresh all core data sources
 * This is called by the refresh API endpoint (triggered by GitHub Actions)
 */
export async function refreshCoreData(): Promise<DashboardData> {
  const errors: string[] = [];
  let weather: WeatherData | null = null;
  let transit: TransitData | null = null;
  let calendar: CalendarData | null = null;

  // Fetch all data in parallel
  const results = await Promise.allSettled([
    getWeather(),
    getTransitDepartures(),
    getCalendarEvents(),
  ]);

  // Process results
  if (results[0].status === 'fulfilled') {
    weather = results[0].value;
  } else {
    errors.push(`Weather: ${results[0].reason}`);
    console.error('Weather fetch failed:', results[0].reason);
  }

  if (results[1].status === 'fulfilled') {
    transit = results[1].value;
  } else {
    errors.push(`Transit: ${results[1].reason}`);
    console.error('Transit fetch failed:', results[1].reason);
  }

  if (results[2].status === 'fulfilled') {
    calendar = results[2].value;
  } else {
    errors.push(`Calendar: ${results[2].reason}`);
    console.error('Calendar fetch failed:', results[2].reason);
  }

  const dashboardData: DashboardData = {
    weather,
    transit,
    calendar,
    errors,
    refreshedAt: new Date().toISOString(),
  };

  // Cache the combined dashboard data
  await cacheSet(CACHE_KEYS.DASHBOARD_DATA, dashboardData, 15 * 60);

  return dashboardData;
}
```

### 2.10 Create Refresh API Endpoint

Create `src/app/api/refresh/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { refreshCoreData } from '@/lib/api/refresh';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/refresh
 * Triggers a refresh of all cached data
 * Called by GitHub Actions every 15 minutes
 */
export async function POST(request: NextRequest) {
  // Verify the request is from GitHub Actions
  const authHeader = request.headers.get('Authorization');

  if (!CRON_SECRET) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting data refresh...');
    const data = await refreshCoreData();

    const hasErrors = data.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors,
      refreshedAt: data.refreshedAt,
      errors: data.errors,
      summary: {
        weather: data.weather ? 'OK' : 'FAILED',
        transit: data.transit ? 'OK' : 'FAILED',
        calendar: data.calendar ? 'OK' : 'FAILED',
      },
    }, {
      status: hasErrors ? 207 : 200,  // 207 = Multi-Status (partial success)
    });
  } catch (error) {
    console.error('Refresh failed:', error);
    return NextResponse.json(
      { error: 'Refresh failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/refresh
 * Health check for the refresh endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/refresh',
    method: 'POST',
    requiresAuth: true,
  });
}
```

### 2.11 Update Health Check

Update `src/app/api/health/route.ts` to include API checks:

```typescript
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getRedis } from '@/lib/cache/redis';

export async function GET() {
  const health = {
    mongodb: false,
    redis: false,
    apis: {
      weather: false,
      transit: false,
      calendar: false,
    },
    timestamp: new Date().toISOString(),
  };

  // Test MongoDB
  try {
    const mongoose = await connectToDatabase();
    health.mongodb = mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('MongoDB health check failed:', error);
  }

  // Test Redis
  try {
    const redis = getRedis();
    await redis.ping();
    health.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  // Check API configuration (not actual calls to avoid rate limits)
  health.apis.weather = true;  // Open-Meteo has no auth
  health.apis.transit = !!process.env.TFNSW_API_KEY;
  health.apis.calendar = !!(
    process.env.GOOGLE_CLIENT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_CALENDAR_ID
  );

  const allHealthy = health.mongodb && health.redis;
  const allApisConfigured = Object.values(health.apis).every(Boolean);

  return NextResponse.json(health, {
    status: allHealthy ? (allApisConfigured ? 200 : 206) : 503,
  });
}
```

### 2.12 Verify Setup

```bash
# Start the dev server
pnpm dev

# Test health endpoint (should show API config status)
curl http://localhost:3000/api/health

# Test refresh endpoint (requires CRON_SECRET)
curl -X POST http://localhost:3000/api/refresh \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Files Created

- `src/types/weather.ts`
- `src/types/transport.ts`
- `src/types/calendar.ts`
- `src/lib/api/weather.ts`
- `src/lib/api/transport.ts`
- `src/lib/api/calendar.ts`
- `src/lib/api/refresh.ts`
- `src/app/api/refresh/route.ts`
- `src/app/api/health/route.ts` (updated)

## Manual Checklist

- [ ] Created Transport NSW account
- [ ] Obtained TfNSW API key
- [ ] Created Google Cloud project
- [ ] Enabled Google Calendar API
- [ ] Created service account and downloaded JSON key
- [ ] Shared calendar with service account email
- [ ] Added all environment variables to `.env.local`:
  - [ ] `TFNSW_API_KEY`
  - [ ] `GOOGLE_CLIENT_EMAIL`
  - [ ] `GOOGLE_PRIVATE_KEY`
  - [ ] `GOOGLE_CALENDAR_ID`
  - [ ] `CRON_SECRET`
- [ ] Health endpoint shows `apis` all configured

## API Rate Limits Reference

| API | Daily Limit | Recommended Refresh |
|-----|-------------|---------------------|
| Open-Meteo | 10,000 | Every 15 min (96/day) |
| Transport NSW | 60,000 | Every 5 min (288/day) |
| Google Calendar | Unlimited* | Every 10 min (144/day) |

*Google Calendar has per-user quotas that are very generous for personal use.

## Next Step

Proceed to [Step 3: Gaming Integrations](./03-gaming-integrations.md) for Steam, Xbox, and PlayStation API setup.
