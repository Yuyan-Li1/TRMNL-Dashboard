# Step 1: Database Setup

## Overview

Set up MongoDB Atlas for persistent storage and Upstash Redis for caching. This step requires manual account creation.

## ⚠️ MANUAL ACTION REQUIRED

Before implementing this step, you must:

### 1.1 Create MongoDB Atlas Account

1. Go to <https://www.mongodb.com/cloud/atlas>
2. Sign up for a free account
3. Create a new project called "trmnl-dashboard"
4. Create a free M0 cluster:
   - Provider: AWS
   - Region: Sydney (ap-southeast-2) for lowest latency
   - Cluster name: `trmnl-cluster`
5. **IMPORTANT**: Set up Network Access:
   - Go to Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (adds `0.0.0.0/0`)
   - This is required for Vercel serverless functions
6. Create a database user:
   - Go to Database Access → Add New Database User
   - Username: `trmnl-app`
   - Password: Generate a secure password
   - Role: Read and write to any database
7. Get your connection string:
   - Go to Databases → Connect → Drivers
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Replace `<dbname>` with `trmnl`

**Save this value:**

```text
MONGODB_URI=mongodb+srv://trmnl-app:YOUR_PASSWORD@trmnl-cluster.xxxxx.mongodb.net/trmnl?retryWrites=true&w=majority
```

### 1.2 Create Upstash Account

1. Go to <https://upstash.com>
2. Sign up for a free account
3. Create a new Redis database:
   - Name: `trmnl-cache`
   - Region: Sydney (closest to your location)
   - Type: Regional
4. Go to the database details and copy:
   - REST URL
   - REST Token

**Save these values:**

```text
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### 1.3 Update Environment Variables

Add the MongoDB and Upstash values to your `.env.local` file.

---

## Implementation

After completing manual setup, implement the following:

### 1.4 Create MongoDB Connection Utility

Create `src/lib/db/mongodb.ts`:

```typescript
import mongoose from 'mongoose';

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
```

### 1.5 Create Redis Cache Utility

Create `src/lib/cache/redis.ts`:

```typescript
import { Redis } from '@upstash/redis';

// Singleton pattern for Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('Missing Upstash Redis environment variables');
    }

    redis = new Redis({ url, token });
  }

  return redis;
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  WEATHER: 15 * 60,      // 15 minutes
  TRANSIT: 5 * 60,       // 5 minutes
  CALENDAR: 10 * 60,     // 10 minutes
  GAMING: 60 * 60,       // 1 hour
  TOKEN_HEALTH: 5 * 60,  // 5 minutes
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  WEATHER: 'weather:sydney',
  TRANSIT: 'transit:lidcombe',
  CALENDAR: 'calendar:events',
  GAMING_STEAM: 'gaming:steam',
  GAMING_XBOX: 'gaming:xbox',
  GAMING_PSN: 'gaming:psn',
  TOKEN_HEALTH: 'tokens:health',
  DASHBOARD_DATA: 'dashboard:data',
} as const;

/**
 * Generic cache get with JSON parsing
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const data = await redis.get<T>(key);
  return data;
}

/**
 * Generic cache set with TTL
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  await redis.setex(key, ttlSeconds, data);
}

/**
 * Delete a cache key
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

/**
 * Check if key exists and get TTL
 */
export async function cacheTTL(key: string): Promise<number> {
  const redis = getRedis();
  return redis.ttl(key);
}
```

### 1.6 Create Schedule Model

Create `src/lib/db/models/schedule.ts`:

```typescript
import mongoose, { Schema, Document, Model } from 'mongoose';
import { DayType, TimeBlock, WidgetType } from '@/types';

// Widget configuration within a time block
export interface IWidgetConfig {
  type: WidgetType;
  priority: number;  // Lower = more important = larger/higher position
  enabled: boolean;
  config?: Record<string, unknown>;  // Widget-specific settings
}

// Time block configuration
export interface ITimeBlockConfig {
  name: TimeBlock;
  startTime: string;  // "HH:mm" format
  endTime: string;    // "HH:mm" format
  widgets: IWidgetConfig[];
}

// Schedule document interface
export interface ISchedule extends Document {
  name: string;
  dayType: DayType;
  daysOfWeek: number[];  // 0 = Sunday, 6 = Saturday
  timeBlocks: ITimeBlockConfig[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WidgetConfigSchema = new Schema<IWidgetConfig>({
  type: {
    type: String,
    enum: ['weather', 'transit', 'calendar', 'gaming', 'routine', 'medication'],
    required: true,
  },
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  config: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

const TimeBlockConfigSchema = new Schema<ITimeBlockConfig>({
  name: {
    type: String,
    enum: ['morning', 'workday', 'evening', 'night'],
    required: true,
  },
  startTime: {
    type: String,
    required: true,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,  // HH:mm format
  },
  endTime: {
    type: String,
    required: true,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,
  },
  widgets: [WidgetConfigSchema],
});

const ScheduleSchema = new Schema<ISchedule>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dayType: {
      type: String,
      enum: ['office', 'wfh', 'weekend'],
      required: true,
    },
    daysOfWeek: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr: number[]) =>
          arr.every((d) => d >= 0 && d <= 6),
        message: 'Days must be 0-6 (Sunday-Saturday)',
      },
    },
    timeBlocks: [TimeBlockConfigSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ScheduleSchema.index({ daysOfWeek: 1, isActive: 1 });
ScheduleSchema.index({ dayType: 1 });

// Prevent model recompilation in development
export const Schedule: Model<ISchedule> =
  mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);
```

### 1.7 Create Routine Model

Create `src/lib/db/models/routine.ts`:

```typescript
import mongoose, { Schema, Document, Model } from 'mongoose';

// Individual step in a routine
export interface IRoutineStep {
  order: number;
  title: string;
  description?: string;
  duration?: number;  // Duration in minutes
  isOptional: boolean;
}

// Routine recurrence pattern
export interface IRecurrence {
  type: 'daily' | 'weekly' | 'custom';
  // For weekly: which days (0-6)
  daysOfWeek?: number[];
  // For custom: specific dates or pattern
  customPattern?: string;
}

// Routine document interface
export interface IRoutine extends Document {
  name: string;
  category: 'morning' | 'evening' | 'medication' | 'skincare' | 'custom';
  steps: IRoutineStep[];
  recurrence: IRecurrence;
  timeWindow: {
    startTime: string;  // "HH:mm"
    endTime: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoutineStepSchema = new Schema<IRoutineStep>({
  order: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  duration: {
    type: Number,
    min: 1,
  },
  isOptional: {
    type: Boolean,
    default: false,
  },
});

const RecurrenceSchema = new Schema<IRecurrence>({
  type: {
    type: String,
    enum: ['daily', 'weekly', 'custom'],
    required: true,
  },
  daysOfWeek: {
    type: [Number],
    validate: {
      validator: (arr: number[]) =>
        !arr || arr.every((d) => d >= 0 && d <= 6),
      message: 'Days must be 0-6',
    },
  },
  customPattern: String,
});

const RoutineSchema = new Schema<IRoutine>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['morning', 'evening', 'medication', 'skincare', 'custom'],
      required: true,
    },
    steps: [RoutineStepSchema],
    recurrence: {
      type: RecurrenceSchema,
      required: true,
    },
    timeWindow: {
      startTime: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      },
      endTime: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

RoutineSchema.index({ category: 1, isActive: 1 });
RoutineSchema.index({ 'recurrence.daysOfWeek': 1 });

export const Routine: Model<IRoutine> =
  mongoose.models.Routine || mongoose.model<IRoutine>('Routine', RoutineSchema);
```

### 1.8 Create Token Health Model

Create `src/lib/db/models/token.ts`:

```typescript
import mongoose, { Schema, Document, Model } from 'mongoose';
import { Service, TokenStatus } from '@/types';

// Token health tracking document
export interface ITokenHealth extends Document {
  service: Service;
  status: TokenStatus;
  lastChecked: Date;
  lastSuccess?: Date;
  expiresAt?: Date;
  refreshToken?: string;  // Encrypted, for PSN
  accessToken?: string;   // Encrypted, for PSN
  accessTokenExpiresAt?: Date;
  errorMessage?: string;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const TokenHealthSchema = new Schema<ITokenHealth>(
  {
    service: {
      type: String,
      enum: ['psn', 'xbox', 'steam', 'google', 'tfnsw'],
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['healthy', 'expiring_soon', 'expired', 'error'],
      default: 'healthy',
    },
    lastChecked: {
      type: Date,
      default: Date.now,
    },
    lastSuccess: Date,
    expiresAt: Date,
    // PSN-specific token storage
    refreshToken: String,
    accessToken: String,
    accessTokenExpiresAt: Date,
    errorMessage: String,
    errorCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

TokenHealthSchema.index({ service: 1 }, { unique: true });
TokenHealthSchema.index({ status: 1 });

export const TokenHealth: Model<ITokenHealth> =
  mongoose.models.TokenHealth ||
  mongoose.model<ITokenHealth>('TokenHealth', TokenHealthSchema);
```

### 1.9 Create Database Seed Script

Create `src/lib/db/seed.ts`:

```typescript
import 'dotenv/config';
import mongoose from 'mongoose';
import { Schedule } from './models/schedule';
import { Routine } from './models/routine';
import { TokenHealth } from './models/token';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI not set');
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  console.log('Clearing existing data...');
  await Schedule.deleteMany({});
  await Routine.deleteMany({});
  await TokenHealth.deleteMany({});

  console.log('Creating default schedules...');

  // Office days: Monday, Tuesday, Wednesday
  await Schedule.create({
    name: 'Office Days',
    dayType: 'office',
    daysOfWeek: [1, 2, 3],  // Mon, Tue, Wed
    timeBlocks: [
      {
        name: 'morning',
        startTime: '06:00',
        endTime: '09:00',
        widgets: [
          { type: 'routine', priority: 1, enabled: true, config: { category: 'morning' } },
          { type: 'weather', priority: 2, enabled: true },
          { type: 'transit', priority: 3, enabled: true },
        ],
      },
      {
        name: 'workday',
        startTime: '09:00',
        endTime: '18:00',
        widgets: [
          { type: 'calendar', priority: 1, enabled: true },
          { type: 'weather', priority: 2, enabled: true },
        ],
      },
      {
        name: 'evening',
        startTime: '18:00',
        endTime: '22:00',
        widgets: [
          { type: 'routine', priority: 1, enabled: true, config: { category: 'skincare' } },
          { type: 'weather', priority: 2, enabled: true },
        ],
      },
    ],
    isActive: true,
  });

  // WFH days: Thursday, Friday
  await Schedule.create({
    name: 'Work From Home',
    dayType: 'wfh',
    daysOfWeek: [4, 5],  // Thu, Fri
    timeBlocks: [
      {
        name: 'morning',
        startTime: '07:00',
        endTime: '09:00',
        widgets: [
          { type: 'weather', priority: 1, enabled: true },
          { type: 'calendar', priority: 2, enabled: true },
        ],
      },
      {
        name: 'workday',
        startTime: '09:00',
        endTime: '18:00',
        widgets: [
          { type: 'medication', priority: 1, enabled: true },
          { type: 'calendar', priority: 2, enabled: true },
        ],
      },
      {
        name: 'evening',
        startTime: '18:00',
        endTime: '22:00',
        widgets: [
          { type: 'routine', priority: 1, enabled: true, config: { category: 'skincare' } },
          { type: 'gaming', priority: 2, enabled: true },
        ],
      },
    ],
    isActive: true,
  });

  // Weekend: Saturday, Sunday
  await Schedule.create({
    name: 'Weekend',
    dayType: 'weekend',
    daysOfWeek: [0, 6],  // Sun, Sat
    timeBlocks: [
      {
        name: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        widgets: [
          { type: 'weather', priority: 1, enabled: true },
          { type: 'gaming', priority: 2, enabled: true },
        ],
      },
      {
        name: 'workday',  // Daytime on weekends
        startTime: '12:00',
        endTime: '18:00',
        widgets: [
          { type: 'weather', priority: 1, enabled: true },
          { type: 'gaming', priority: 2, enabled: true },
        ],
      },
      {
        name: 'evening',
        startTime: '18:00',
        endTime: '23:00',
        widgets: [
          { type: 'gaming', priority: 1, enabled: true },
          { type: 'routine', priority: 2, enabled: true, config: { category: 'skincare' } },
        ],
      },
    ],
    isActive: true,
  });

  console.log('Creating default routines...');

  // Morning routine for office days
  await Routine.create({
    name: 'Office Morning Routine',
    category: 'morning',
    steps: [
      { order: 1, title: 'Check weather', description: 'Umbrella if rain > 30%', isOptional: false },
      { order: 2, title: 'Morning skincare', description: 'Cleanser → Toner → Moisturizer → SPF', isOptional: false, duration: 5 },
      { order: 3, title: 'Pack bag', description: 'Laptop, charger, water bottle', isOptional: false },
      { order: 4, title: 'Put on perfume', isOptional: true },
    ],
    recurrence: {
      type: 'weekly',
      daysOfWeek: [1, 2, 3],  // Office days
    },
    timeWindow: {
      startTime: '06:30',
      endTime: '08:00',
    },
    isActive: true,
  });

  // Evening skincare routine - alternating days
  await Routine.create({
    name: 'Evening Skincare (Retinol Days)',
    category: 'skincare',
    steps: [
      { order: 1, title: 'Double cleanse', description: 'Oil cleanser → Water cleanser', duration: 3, isOptional: false },
      { order: 2, title: 'Toner', isOptional: false },
      { order: 3, title: 'Retinol serum', description: 'Wait 20 min before next step', duration: 20, isOptional: false },
      { order: 4, title: 'Moisturizer', isOptional: false },
    ],
    recurrence: {
      type: 'weekly',
      daysOfWeek: [1, 3, 5],  // Mon, Wed, Fri
    },
    timeWindow: {
      startTime: '20:00',
      endTime: '22:00',
    },
    isActive: true,
  });

  await Routine.create({
    name: 'Evening Skincare (Hydration Days)',
    category: 'skincare',
    steps: [
      { order: 1, title: 'Double cleanse', description: 'Oil cleanser → Water cleanser', duration: 3, isOptional: false },
      { order: 2, title: 'Toner', isOptional: false },
      { order: 3, title: 'Hyaluronic acid serum', isOptional: false },
      { order: 4, title: 'Sheet mask', description: '15-20 minutes', duration: 15, isOptional: true },
      { order: 5, title: 'Moisturizer', isOptional: false },
      { order: 6, title: 'Sleeping mask', isOptional: true },
    ],
    recurrence: {
      type: 'weekly',
      daysOfWeek: [0, 2, 4, 6],  // Sun, Tue, Thu, Sat
    },
    timeWindow: {
      startTime: '20:00',
      endTime: '22:00',
    },
    isActive: true,
  });

  // Medication reminder
  await Routine.create({
    name: 'Daily Medication',
    category: 'medication',
    steps: [
      { order: 1, title: 'Take vitamins', description: 'With food', isOptional: false },
    ],
    recurrence: {
      type: 'daily',
    },
    timeWindow: {
      startTime: '12:00',
      endTime: '14:00',
    },
    isActive: true,
  });

  console.log('Initializing token health records...');

  // Initialize token health for all services
  const services = ['psn', 'xbox', 'steam', 'google', 'tfnsw'] as const;
  for (const service of services) {
    await TokenHealth.create({
      service,
      status: 'healthy',
      lastChecked: new Date(),
      errorCount: 0,
    });
  }

  console.log('Seed complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

### 1.10 Add tsx for Running Seed Script

```bash
pnpm add -D tsx
```

### 1.11 Test Database Connection

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getRedis } from '@/lib/cache/redis';

export async function GET() {
  const health = {
    mongodb: false,
    redis: false,
    timestamp: new Date().toISOString(),
  };

  try {
    // Test MongoDB
    const mongoose = await connectToDatabase();
    health.mongodb = mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('MongoDB health check failed:', error);
  }

  try {
    // Test Redis
    const redis = getRedis();
    await redis.ping();
    health.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  const allHealthy = health.mongodb && health.redis;

  return NextResponse.json(health, {
    status: allHealthy ? 200 : 503,
  });
}
```

### 1.12 Verify Setup

```bash
# Run the seed script
pnpm db:seed

# Start the dev server
pnpm dev

# Test health endpoint
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "mongodb": true,
  "redis": true,
  "timestamp": "2024-..."
}
```

## Files Created

- `src/lib/db/mongodb.ts`
- `src/lib/cache/redis.ts`
- `src/lib/db/models/schedule.ts`
- `src/lib/db/models/routine.ts`
- `src/lib/db/models/token.ts`
- `src/lib/db/seed.ts`
- `src/app/api/health/route.ts`

## Manual Checklist

- [ ] Created MongoDB Atlas account
- [ ] Created free M0 cluster in Sydney region
- [ ] Added `0.0.0.0/0` to IP whitelist
- [ ] Created database user
- [ ] Copied connection string to `.env.local`
- [ ] Created Upstash account
- [ ] Created Redis database in Sydney region
- [ ] Copied Redis URL and token to `.env.local`
- [ ] Ran seed script successfully
- [ ] Health endpoint returns `mongodb: true, redis: true`

## Next Step

Proceed to [Step 2: Core API Integrations](./02-core-api-integrations.md) for weather, transit, and calendar setup.
