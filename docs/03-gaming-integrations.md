# Step 3: Gaming Integrations

## Overview

Set up gaming platform APIs to display recent gameplay, achievements, and trophies: Steam, Xbox (via OpenXBL), and PlayStation Network (via psn-api).

## ⚠️ MANUAL ACTION REQUIRED

### 3.1 Steam API Key

1. Go to <https://steamcommunity.com/dev/apikey>
2. Log in with your Steam account
3. Register for an API key (any domain name works, e.g., "localhost")
4. Copy your API key
5. Get your Steam ID (64-bit):
   - Visit <https://steamid.io>
   - Enter your Steam profile URL
   - Copy the "steamID64" value

**Save these values:**

```text
STEAM_API_KEY=your-32-character-api-key
STEAM_ID=76561198000000000
```

### 3.2 OpenXBL API Key (Xbox)

1. Go to <https://xbl.io>
2. Sign in with your Microsoft account
3. Go to your profile/dashboard
4. Copy your API key

**Save this value:**

```text
OPENXBL_API_KEY=your-api-key-here
```

### 3.3 PlayStation Network NPSSO Token

This is the most manual step - PSN doesn't have a public API, so we use browser cookies.

1. In your web browser, go to <https://www.playstation.com>
2. Click "Sign In" and log in with your PSN account
3. In the **same browser** (cookies must persist), visit:
   <https://ca.account.sony.com/api/v1/ssocookie>
4. You'll see a JSON response like:

   ```json
   {"npsso":"<64-character-token>"}
   ```

5. Copy the 64-character token value

**Save this value:**

```text
PSN_NPSSO=your-64-character-npsso-token
```

**Important Notes:**

- NPSSO tokens expire after approximately 2 months
- You'll need to manually repeat this process when the token expires
- The admin UI will warn you when the token is expiring
- If you see `{"error":"..."}`, try a different browser or clear cookies

---

## Implementation

### 3.4 Create Gaming Types

Create `src/types/gaming.ts`:

```typescript
// Platform identifiers
export const GAMING_PLATFORMS = ['steam', 'xbox', 'playstation'] as const;
export type GamingPlatform = typeof GAMING_PLATFORMS[number];

// Individual game with playtime info
export interface RecentGame {
  platform: GamingPlatform;
  gameId: string;
  title: string;
  imageUrl?: string;
  lastPlayed?: string;  // ISO timestamp
  playtimeRecent?: number;  // Minutes played in last 2 weeks
  playtimeTotal?: number;   // Total minutes played
  achievementsEarned?: number;
  achievementsTotal?: number;
}

// Platform-specific data
export interface SteamData {
  playerId: string;
  playerName: string;
  avatarUrl?: string;
  recentGames: RecentGame[];
  fetchedAt: string;
}

export interface XboxData {
  gamertag: string;
  gamerScore: number;
  avatarUrl?: string;
  recentGames: RecentGame[];
  fetchedAt: string;
}

export interface PlayStationData {
  onlineId: string;
  accountId: string;
  avatarUrl?: string;
  trophyLevel: number;
  trophyProgress: number;
  recentGames: RecentGame[];
  fetchedAt: string;
}

// Combined gaming data
export interface GamingData {
  steam: SteamData | null;
  xbox: XboxData | null;
  playstation: PlayStationData | null;
  allRecentGames: RecentGame[];  // Combined and sorted
  errors: string[];
  fetchedAt: string;
}

// Trophy/Achievement types
export interface Trophy {
  trophyId: string;
  name: string;
  description?: string;
  type: 'platinum' | 'gold' | 'silver' | 'bronze';
  earned: boolean;
  earnedAt?: string;
  rarity?: number;  // Percentage of players who earned it
}

export interface Achievement {
  achievementId: string;
  name: string;
  description?: string;
  gamerscore?: number;  // Xbox only
  earned: boolean;
  earnedAt?: string;
  rarity?: number;
}
```

### 3.5 Create Steam API Client

Create `src/lib/api/steam.ts`:

```typescript
import SteamAPI from 'steamapi';
import { SteamData, RecentGame } from '@/types/gaming';
import { cacheGet, cacheSet, CACHE_TTL, CACHE_KEYS } from '@/lib/cache/redis';

const STEAM_ID = process.env.STEAM_ID;

// Singleton SteamAPI instance
const steam = new SteamAPI(process.env.STEAM_API_KEY!);

/**
 * Get Steam data with caching
 * Rate limit: 100,000 requests/day
 */
export async function getSteamData(): Promise<SteamData> {
  // Try cache first
  const cached = await cacheGet<SteamData>(CACHE_KEYS.GAMING_STEAM);
  if (cached) {
    return cached;
  }

  if (!STEAM_ID) {
    throw new Error('STEAM_ID not configured');
  }

  // Fetch fresh data using steamapi package
  const [userSummary, recentGamesRaw] = await Promise.all([
    steam.getUserSummary(STEAM_ID),
    steam.getUserRecentGames(STEAM_ID),
  ]);

  const recentGames: RecentGame[] = recentGamesRaw.map((game) => ({
    platform: 'steam' as const,
    gameId: game.appID.toString(),
    title: game.name,
    imageUrl: game.iconURL,
    playtimeRecent: game.playTime2,
    playtimeTotal: game.playTime,
  }));

  const data: SteamData = {
    playerId: STEAM_ID,
    playerName: userSummary.nickname,
    avatarUrl: userSummary.avatar.large,
    recentGames,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 1 hour
  await cacheSet(CACHE_KEYS.GAMING_STEAM, data, CACHE_TTL.GAMING);

  return data;
}
```

### 3.6 Create Xbox API Client

Create `src/lib/api/xbox.ts`:

```typescript
import { XboxData, RecentGame } from '@/types/gaming';
import { cacheGet, cacheSet, CACHE_TTL, CACHE_KEYS } from '@/lib/cache/redis';

const OPENXBL_API_KEY = process.env.OPENXBL_API_KEY;

const OPENXBL_BASE = 'https://xbl.io/api/v2';

interface XboxProfile {
  profileUsers: Array<{
    id: string;
    settings: Array<{
      id: string;
      value: string;
    }>;
  }>;
}

interface XboxTitleHistory {
  titles: Array<{
    titleId: string;
    name: string;
    displayImage: string;
    lastPlayed?: string;
    achievement?: {
      currentGamerscore: number;
      totalGamerscore: number;
    };
  }>;
}

/**
 * Fetch Xbox profile
 * Rate limit: 150 requests/hour
 */
async function fetchXboxProfile(): Promise<XboxProfile | null> {
  if (!OPENXBL_API_KEY) {
    return null;
  }

  const response = await fetch(`${OPENXBL_BASE}/account`, {
    headers: {
      'X-Authorization': OPENXBL_API_KEY,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenXBL API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch recent game history
 */
async function fetchTitleHistory(): Promise<XboxTitleHistory | null> {
  if (!OPENXBL_API_KEY) {
    return null;
  }

  const response = await fetch(`${OPENXBL_BASE}/achievements/title-history`, {
    headers: {
      'X-Authorization': OPENXBL_API_KEY,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenXBL API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Extract setting value from Xbox profile
 */
function getProfileSetting(profile: XboxProfile, settingId: string): string {
  const settings = profile.profileUsers?.[0]?.settings || [];
  return settings.find((s) => s.id === settingId)?.value || '';
}

/**
 * Get Xbox data with caching
 */
export async function getXboxData(): Promise<XboxData> {
  // Try cache first
  const cached = await cacheGet<XboxData>(CACHE_KEYS.GAMING_XBOX);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const [profile, titleHistory] = await Promise.all([
    fetchXboxProfile(),
    fetchTitleHistory(),
  ]);

  const gamertag = profile ? getProfileSetting(profile, 'Gamertag') : 'Xbox User';
  const gamerScore = profile
    ? parseInt(getProfileSetting(profile, 'Gamerscore'), 10) || 0
    : 0;
  const avatarUrl = profile ? getProfileSetting(profile, 'GameDisplayPicRaw') : undefined;

  const recentGames: RecentGame[] = (titleHistory?.titles || [])
    .slice(0, 10)
    .map((title) => ({
      platform: 'xbox' as const,
      gameId: title.titleId,
      title: title.name,
      imageUrl: title.displayImage,
      lastPlayed: title.lastPlayed,
      achievementsEarned: title.achievement?.currentGamerscore,
      achievementsTotal: title.achievement?.totalGamerscore,
    }));

  const data: XboxData = {
    gamertag,
    gamerScore,
    avatarUrl,
    recentGames,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 1 hour
  await cacheSet(CACHE_KEYS.GAMING_XBOX, data, CACHE_TTL.GAMING);

  return data;
}
```

### 3.7 Create PlayStation API Client

Create `src/lib/api/playstation.ts`:

```typescript
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromAccountId,
  getUserTitles,
  type AuthorizationPayload,
} from 'psn-api';
import { PlayStationData, RecentGame } from '@/types/gaming';
import { cacheGet, cacheSet, CACHE_TTL, CACHE_KEYS } from '@/lib/cache/redis';
import { connectToDatabase } from '@/lib/db/mongodb';
import { TokenHealth } from '@/lib/db/models/token';

const PSN_NPSSO = process.env.PSN_NPSSO;

// Token cache (in-memory for the current process)
let cachedAuth: AuthorizationPayload | null = null;
let authExpiresAt: number = 0;

/**
 * Get valid PSN authentication
 * Handles token refresh and database storage
 */
async function getAuth(): Promise<AuthorizationPayload> {
  // Check in-memory cache first
  if (cachedAuth && Date.now() < authExpiresAt) {
    return cachedAuth;
  }

  // Try to get stored refresh token from database
  await connectToDatabase();
  const tokenRecord = await TokenHealth.findOne({ service: 'psn' });

  if (tokenRecord?.refreshToken) {
    try {
      // Try to use refresh token
      const auth = await exchangeRefreshTokenForAuthTokens(tokenRecord.refreshToken);

      // Update cached values
      cachedAuth = auth;
      authExpiresAt = Date.now() + (auth.expiresIn - 60) * 1000;  // 1 minute buffer

      // Update database
      // TODO: Encrypt tokens before storing in database
      // Consider using crypto.createCipheriv with a secret from env vars
      await TokenHealth.updateOne(
        { service: 'psn' },
        {
          $set: {
            status: 'healthy',
            lastChecked: new Date(),
            lastSuccess: new Date(),
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
            accessTokenExpiresAt: new Date(authExpiresAt),
            errorCount: 0,
            errorMessage: undefined,
          },
        }
      );

      return auth;
    } catch (error) {
      console.error('Refresh token failed, falling back to NPSSO:', error);
    }
  }

  // Fall back to NPSSO authentication
  if (!PSN_NPSSO) {
    throw new Error('PSN_NPSSO not configured');
  }

  try {
    const accessCode = await exchangeNpssoForAccessCode(PSN_NPSSO);
    const auth = await exchangeAccessCodeForAuthTokens(accessCode);

    // Update cached values
    cachedAuth = auth;
    authExpiresAt = Date.now() + (auth.expiresIn - 60) * 1000;

    // Store tokens in database
    // TODO: Encrypt tokens before storing in database
    // Consider using crypto.createCipheriv with a secret from env vars
    await TokenHealth.updateOne(
      { service: 'psn' },
      {
        $set: {
          status: 'healthy',
          lastChecked: new Date(),
          lastSuccess: new Date(),
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          accessTokenExpiresAt: new Date(authExpiresAt),
          // NPSSO expires in ~2 months
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          errorCount: 0,
          errorMessage: undefined,
        },
      },
      { upsert: true }
    );

    return auth;
  } catch (error) {
    // Update token health to reflect failure
    await TokenHealth.updateOne(
      { service: 'psn' },
      {
        $set: {
          status: 'expired',
          lastChecked: new Date(),
          errorMessage: String(error),
        },
        $inc: { errorCount: 1 },
      }
    );

    throw new Error('PSN authentication failed - NPSSO may be expired');
  }
}

/**
 * Get PlayStation data with caching
 */
export async function getPlayStationData(): Promise<PlayStationData> {
  // Try cache first
  const cached = await cacheGet<PlayStationData>(CACHE_KEYS.GAMING_PSN);
  if (cached) {
    return cached;
  }

  // Get authentication
  const auth = await getAuth();

  // Fetch profile info
  // Note: You need to find your accountId first - one way is via makeUniversalSearch
  // For now, we'll use the token to get our own profile
  const profile = await getProfileFromAccountId(auth, 'me');

  // Fetch recent games (title history)
  const titlesResponse = await getUserTitles(auth, 'me', {
    limit: 10,
    offset: 0,
  });

  const recentGames: RecentGame[] = (titlesResponse.trophyTitles || []).map((title) => ({
    platform: 'playstation' as const,
    gameId: title.npCommunicationId,
    title: title.trophyTitleName,
    imageUrl: title.trophyTitleIconUrl,
    lastPlayed: title.lastUpdatedDateTime,
    achievementsEarned: title.earnedTrophies
      ? title.earnedTrophies.bronze +
        title.earnedTrophies.silver +
        title.earnedTrophies.gold +
        title.earnedTrophies.platinum
      : undefined,
    achievementsTotal: title.definedTrophies
      ? title.definedTrophies.bronze +
        title.definedTrophies.silver +
        title.definedTrophies.gold +
        title.definedTrophies.platinum
      : undefined,
  }));

  const data: PlayStationData = {
    onlineId: profile.onlineId,
    accountId: profile.accountId,
    avatarUrl: profile.avatarUrls?.[0]?.avatarUrl,
    trophyLevel: profile.trophySummary?.level || 1,
    trophyProgress: profile.trophySummary?.progress || 0,
    recentGames,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 1 hour
  await cacheSet(CACHE_KEYS.GAMING_PSN, data, CACHE_TTL.GAMING);

  return data;
}

/**
 * Check if PSN token needs refresh
 */
export async function checkPSNTokenHealth(): Promise<{
  status: 'healthy' | 'expiring_soon' | 'expired';
  expiresAt?: Date;
  message?: string;
}> {
  await connectToDatabase();
  const tokenRecord = await TokenHealth.findOne({ service: 'psn' });

  if (!tokenRecord) {
    return { status: 'expired', message: 'No PSN token stored' };
  }

  if (tokenRecord.status === 'expired') {
    return {
      status: 'expired',
      message: tokenRecord.errorMessage || 'Token expired',
    };
  }

  if (tokenRecord.expiresAt) {
    const daysUntilExpiry = Math.floor(
      (tokenRecord.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 0) {
      return { status: 'expired', expiresAt: tokenRecord.expiresAt };
    }

    if (daysUntilExpiry <= 7) {
      return {
        status: 'expiring_soon',
        expiresAt: tokenRecord.expiresAt,
        message: `NPSSO expires in ${daysUntilExpiry} days`,
      };
    }
  }

  return {
    status: 'healthy',
    expiresAt: tokenRecord.expiresAt || undefined,
  };
}
```

### 3.8 Create Combined Gaming Data Fetcher

Create `src/lib/api/gaming.ts`:

```typescript
import { GamingData, RecentGame } from '@/types/gaming';
import { getSteamData } from './steam';
import { getXboxData } from './xbox';
import { getPlayStationData } from './playstation';

/**
 * Fetch gaming data from all platforms
 */
export async function getGamingData(): Promise<GamingData> {
  const errors: string[] = [];

  // Fetch from all platforms in parallel
  const results = await Promise.allSettled([
    getSteamData(),
    getXboxData(),
    getPlayStationData(),
  ]);

  const steam = results[0].status === 'fulfilled' ? results[0].value : null;
  const xbox = results[1].status === 'fulfilled' ? results[1].value : null;
  const playstation = results[2].status === 'fulfilled' ? results[2].value : null;

  // Collect errors
  if (results[0].status === 'rejected') {
    errors.push(`Steam: ${results[0].reason}`);
  }
  if (results[1].status === 'rejected') {
    errors.push(`Xbox: ${results[1].reason}`);
  }
  if (results[2].status === 'rejected') {
    errors.push(`PlayStation: ${results[2].reason}`);
  }

  // Combine all recent games and sort by last played
  const allRecentGames: RecentGame[] = [
    ...(steam?.recentGames || []),
    ...(xbox?.recentGames || []),
    ...(playstation?.recentGames || []),
  ].sort((a, b) => {
    const dateA = a.lastPlayed ? new Date(a.lastPlayed).getTime() : 0;
    const dateB = b.lastPlayed ? new Date(b.lastPlayed).getTime() : 0;
    return dateB - dateA;  // Most recent first
  });

  return {
    steam,
    xbox,
    playstation,
    allRecentGames,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Get top N recently played games across all platforms
 */
export async function getTopRecentGames(count: number = 5): Promise<RecentGame[]> {
  const data = await getGamingData();
  return data.allRecentGames.slice(0, count);
}

/**
 * Format playtime for display
 */
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get platform display name
 */
export function getPlatformName(platform: RecentGame['platform']): string {
  switch (platform) {
    case 'steam':
      return 'Steam';
    case 'xbox':
      return 'Xbox';
    case 'playstation':
      return 'PlayStation';
    default:
      return platform;
  }
}

/**
 * Get platform icon name (for e-ink icons)
 */
export function getPlatformIcon(platform: RecentGame['platform']): string {
  switch (platform) {
    case 'steam':
      return 'steam';
    case 'xbox':
      return 'xbox';
    case 'playstation':
      return 'playstation';
    default:
      return 'gamepad';
  }
}
```

### 3.9 Update Refresh API to Include Gaming

Update `src/lib/api/refresh.ts`:

```typescript
import { getWeather } from './weather';
import { getTransitDepartures } from './transport';
import { getCalendarEvents } from './calendar';
import { getGamingData } from './gaming';
import { WeatherData } from '@/types/weather';
import { TransitData } from '@/types/transport';
import { CalendarData } from '@/types/calendar';
import { GamingData } from '@/types/gaming';
import { cacheSet, CACHE_KEYS } from '@/lib/cache/redis';

export interface DashboardData {
  weather: WeatherData | null;
  transit: TransitData | null;
  calendar: CalendarData | null;
  gaming: GamingData | null;
  errors: string[];
  refreshedAt: string;
}

/**
 * Refresh all data sources
 */
export async function refreshAllData(): Promise<DashboardData> {
  const errors: string[] = [];

  // Fetch all data in parallel
  const results = await Promise.allSettled([
    getWeather(),
    getTransitDepartures(),
    getCalendarEvents(),
    getGamingData(),
  ]);

  const weather = results[0].status === 'fulfilled' ? results[0].value : null;
  const transit = results[1].status === 'fulfilled' ? results[1].value : null;
  const calendar = results[2].status === 'fulfilled' ? results[2].value : null;
  const gaming = results[3].status === 'fulfilled' ? results[3].value : null;

  // Collect errors
  if (results[0].status === 'rejected') {
    errors.push(`Weather: ${results[0].reason}`);
  }
  if (results[1].status === 'rejected') {
    errors.push(`Transit: ${results[1].reason}`);
  }
  if (results[2].status === 'rejected') {
    errors.push(`Calendar: ${results[2].reason}`);
  }
  if (results[3].status === 'rejected') {
    errors.push(`Gaming: ${results[3].reason}`);
  }

  // Also include gaming-specific errors
  if (gaming?.errors) {
    errors.push(...gaming.errors);
  }

  const dashboardData: DashboardData = {
    weather,
    transit,
    calendar,
    gaming,
    errors,
    refreshedAt: new Date().toISOString(),
  };

  // Cache combined data
  await cacheSet(CACHE_KEYS.DASHBOARD_DATA, dashboardData, 15 * 60);

  return dashboardData;
}

// Re-export for backwards compatibility
export { refreshAllData as refreshCoreData };
```

### 3.10 Create Token Health API Endpoint

Create `src/app/api/tokens/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { TokenHealth } from '@/lib/db/models/token';
import { checkPSNTokenHealth } from '@/lib/api/playstation';

export async function GET() {
  await connectToDatabase();

  // Get all token health records
  const tokens = await TokenHealth.find({}).lean();

  // Get fresh PSN status
  const psnStatus = await checkPSNTokenHealth();

  // Build response
  const health = tokens.map((token) => ({
    service: token.service,
    status: token.service === 'psn' ? psnStatus.status : token.status,
    lastChecked: token.lastChecked,
    lastSuccess: token.lastSuccess,
    expiresAt: token.service === 'psn' ? psnStatus.expiresAt : token.expiresAt,
    message: token.service === 'psn' ? psnStatus.message : token.errorMessage,
    errorCount: token.errorCount,
  }));

  // Check for any warnings
  const warnings = health.filter(
    (h) => h.status === 'expiring_soon' || h.status === 'expired'
  );

  return NextResponse.json({
    tokens: health,
    hasWarnings: warnings.length > 0,
    warnings: warnings.map((w) => ({
      service: w.service,
      status: w.status,
      message: w.message,
    })),
  });
}
```

### 3.11 Verify Setup

```bash
# Start the dev server
pnpm dev

# Test token health endpoint
curl http://localhost:3000/api/tokens

# Test a full refresh
curl -X POST http://localhost:3000/api/refresh \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected `/api/tokens` response:

```json
{
  "tokens": [
    {
      "service": "psn",
      "status": "healthy",
      "lastChecked": "2024-...",
      "expiresAt": "2024-...",
      "errorCount": 0
    },
    {
      "service": "xbox",
      "status": "healthy",
      "lastChecked": "2024-...",
      "errorCount": 0
    },
    {
      "service": "steam",
      "status": "healthy",
      "lastChecked": "2024-...",
      "errorCount": 0
    }
  ],
  "hasWarnings": false,
  "warnings": []
}
```

## Files Created

- `src/types/gaming.ts`
- `src/lib/api/steam.ts`
- `src/lib/api/xbox.ts`
- `src/lib/api/playstation.ts`
- `src/lib/api/gaming.ts`
- `src/lib/api/refresh.ts` (updated)
- `src/app/api/tokens/route.ts`

## Manual Checklist

- [ ] Registered Steam API key
- [ ] Found Steam ID (64-bit)
- [ ] Created OpenXBL account and copied API key
- [ ] Logged into PlayStation.com
- [ ] Retrieved NPSSO token from ssocookie endpoint
- [ ] Added all environment variables to `.env.local`:
  - [ ] `STEAM_API_KEY`
  - [ ] `STEAM_ID`
  - [ ] `OPENXBL_API_KEY`
  - [ ] `PSN_NPSSO`
- [ ] Token health endpoint shows all services
- [ ] Gaming data appears in refresh response

## API Rate Limits Reference

| API | Rate Limit | Recommended Refresh |
|-----|------------|---------------------|
| Steam | 100,000/day | Every 1 hour (24/day) |
| OpenXBL | 150/hour | Every 1 hour (24/day) |
| PSN | Aggressive | Every 1 hour (cached) |

## Troubleshooting

### Steam: "Forbidden" or "Unauthorized"

- Verify API key is correct (32 characters)
- Ensure Steam ID is the 64-bit version (starts with 7656)
- Check if Steam profile is public

### Xbox: "401 Unauthorized"

- Regenerate API key from xbl.io dashboard
- Ensure you're using the correct header: `X-Authorization`

### PSN: "NPSSO expired" or "Invalid grant"

1. Go to <https://www.playstation.com> and sign in
2. Visit <https://ca.account.sony.com/api/v1/ssocookie>
3. Copy the new NPSSO token
4. Update `PSN_NPSSO` in environment variables
5. Clear the PSN cache key in Redis (or wait for expiry)

### PSN: "Error" response when getting ssocookie

- Try a different browser (Chrome, Firefox, Safari)
- Clear all PlayStation cookies and sign in again
- Ensure you're logged into the correct PSN account
- Some regions may use different URLs (try removing `ca.` from the URL)

## Next Step

Proceed to [Step 4: Schedule System](./04-schedule-system.md) to implement day type and time block logic.
