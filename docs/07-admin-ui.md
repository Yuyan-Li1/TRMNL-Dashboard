# Step 7: Admin UI

## Overview

Create an admin interface for managing schedules, routines, and monitoring API token health. This UI is separate from the TRMNL dashboard and is designed for use on regular screens.

## Features

- Schedule management (day types, time blocks, widgets)
- Routine management (steps, recurrence)
- Token health monitoring (PSN, Xbox, Steam, etc.)
- Dashboard preview

---

## Implementation

### 7.1 Create Admin Layout

Create `src/app/(admin)/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'TRMNL Admin',
  description: 'Admin dashboard for TRMNL',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">
        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link
                  href="/admin"
                  className="flex items-center px-2 text-xl font-bold text-gray-900"
                >
                  TRMNL Admin
                </Link>

                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <NavLink href="/admin">Dashboard</NavLink>
                  <NavLink href="/admin/schedules">Schedules</NavLink>
                  <NavLink href="/admin/routines">Routines</NavLink>
                  <NavLink href="/admin/tokens">Tokens</NavLink>
                </div>
              </div>

              <div className="flex items-center">
                <Link
                  href="/"
                  target="_blank"
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  View Dashboard →
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
    >
      {children}
    </Link>
  );
}
```

### 7.2 Create Admin Dashboard Page

Create `src/app/(admin)/admin/page.tsx`:

```typescript
import Link from 'next/link';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Schedule } from '@/lib/db/models/schedule';
import { Routine } from '@/lib/db/models/routine';
import { TokenHealth } from '@/lib/db/models/token';
import { getScheduleContext } from '@/lib/schedule/context';
import { cacheGet, CACHE_KEYS } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await connectToDatabase();

  // Get counts
  const [scheduleCount, routineCount, tokens, context, dashboardData] = await Promise.all([
    Schedule.countDocuments({ isActive: true }),
    Routine.countDocuments({ isActive: true }),
    TokenHealth.find({}).lean(),
    getScheduleContext(),
    cacheGet(CACHE_KEYS.DASHBOARD_DATA),
  ]);

  const tokenWarnings = tokens.filter(
    (t) => t.status === 'expired' || t.status === 'expiring_soon'
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Warning banner */}
      {tokenWarnings.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="shrink-0">⚠️</div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {tokenWarnings.length} token(s) need attention.{' '}
                <Link href="/admin/tokens" className="font-medium underline">
                  View tokens
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Schedules"
          value={scheduleCount}
          href="/admin/schedules"
        />
        <StatCard
          title="Active Routines"
          value={routineCount}
          href="/admin/routines"
        />
        <StatCard
          title="Token Health"
          value={`${tokens.length - tokenWarnings.length}/${tokens.length}`}
          status={tokenWarnings.length > 0 ? 'warning' : 'success'}
          href="/admin/tokens"
        />
        <StatCard
          title="Data Age"
          value={dashboardData?.refreshedAt
            ? getTimeAgo(new Date(dashboardData.refreshedAt))
            : 'No data'}
          status={dashboardData ? 'success' : 'error'}
        />
      </div>

      {/* Current context */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Current Context</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Day Type</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 capitalize">
              {context.dayType}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Time Block</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 capitalize">
              {context.timeBlock}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Date</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {context.date}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Time</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {context.time}
            </dd>
          </div>
        </dl>

        {context.specialConditions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Active Conditions</h3>
            <div className="flex flex-wrap gap-2">
              {context.specialConditions.map((condition, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    condition.severity === 'high'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {condition.message}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/preview"
            target="_blank"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Preview Dashboard
          </Link>
          <button
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            onClick={() => {
              // Would trigger a manual refresh
            }}
          >
            Force Refresh
          </button>
          <Link
            href="/api/health"
            target="_blank"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Health Check
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
  status,
}: {
  title: string;
  value: string | number;
  href?: string;
  status?: 'success' | 'warning' | 'error';
}) {
  const statusColors = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  };

  const content = (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className={`mt-1 text-3xl font-semibold ${status ? statusColors[status] : 'text-gray-900'}`}>
              {value}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
```

### 7.3 Create Schedules Management Page

Create `src/app/(admin)/admin/schedules/page.tsx`:

```typescript
import Link from 'next/link';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Schedule, ISchedule } from '@/lib/db/models/schedule';

export const dynamic = 'force-dynamic';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function SchedulesPage() {
  await connectToDatabase();
  const schedules = await Schedule.find({}).sort({ dayType: 1 }).lean();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
        <Link
          href="/admin/schedules/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Add Schedule
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {schedules.map((schedule) => (
            <li key={schedule._id?.toString()}>
              <Link
                href={`/admin/schedules/${schedule._id}`}
                className="block hover:bg-gray-50"
              >
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {schedule.name}
                      </p>
                      <span
                        className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          schedule.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="ml-2 shrink-0 flex">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded">
                        {schedule.dayType}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        Days: {schedule.daysOfWeek.map((d) => dayNames[d]).join(', ')}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <p>{schedule.timeBlocks.length} time blocks</p>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}

          {schedules.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">
              No schedules configured. Create one to get started.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
```

### 7.4 Create Schedule Editor Component

Create `src/components/admin/ScheduleEditor.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DayType, TimeBlock, WidgetType } from '@/types';

interface TimeBlockConfig {
  name: TimeBlock;
  startTime: string;
  endTime: string;
  widgets: Array<{
    type: WidgetType;
    priority: number;
    enabled: boolean;
  }>;
}

interface ScheduleFormData {
  name: string;
  dayType: DayType;
  daysOfWeek: number[];
  timeBlocks: TimeBlockConfig[];
  isActive: boolean;
}

interface ScheduleEditorProps {
  initialData?: ScheduleFormData;
  scheduleId?: string;
}

const dayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const widgetOptions: WidgetType[] = [
  'weather',
  'transit',
  'calendar',
  'gaming',
  'routine',
  'medication',
];

export function ScheduleEditor({ initialData, scheduleId }: ScheduleEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ScheduleFormData>(
    initialData || {
      name: '',
      dayType: 'office',
      daysOfWeek: [],
      timeBlocks: [],
      isActive: true,
    }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const method = scheduleId ? 'PUT' : 'POST';
      const url = scheduleId
        ? `/api/admin/schedules/${scheduleId}`
        : '/api/admin/schedules';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');

      router.push('/admin/schedules');
      router.refresh();
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const addTimeBlock = () => {
    setFormData((prev) => ({
      ...prev,
      timeBlocks: [
        ...prev.timeBlocks,
        {
          name: 'morning' as TimeBlock,
          startTime: '06:00',
          endTime: '09:00',
          widgets: [],
        },
      ],
    }));
  };

  const removeTimeBlock = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      timeBlocks: prev.timeBlocks.filter((_, i) => i !== index),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic info */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Day Type</label>
            <select
              value={formData.dayType}
              onChange={(e) => setFormData({ ...formData, dayType: e.target.value as DayType })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="office">Office</option>
              <option value="wfh">Work From Home</option>
              <option value="weekend">Weekend</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((day) => (
              <label
                key={day.value}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer ${
                  formData.daysOfWeek.includes(day.value)
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={formData.daysOfWeek.includes(day.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        daysOfWeek: [...formData.daysOfWeek, day.value].sort(),
                      });
                    } else {
                      setFormData({
                        ...formData,
                        daysOfWeek: formData.daysOfWeek.filter((d) => d !== day.value),
                      });
                    }
                  }}
                />
                {day.label.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">Active</span>
          </label>
        </div>
      </div>

      {/* Time blocks */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Time Blocks</h2>
          <button
            type="button"
            onClick={addTimeBlock}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            + Add Time Block
          </button>
        </div>

        <div className="space-y-4">
          {formData.timeBlocks.map((block, blockIndex) => (
            <TimeBlockEditor
              key={blockIndex}
              block={block}
              onChange={(updated) => {
                const newBlocks = [...formData.timeBlocks];
                newBlocks[blockIndex] = updated;
                setFormData({ ...formData, timeBlocks: newBlocks });
              }}
              onRemove={() => removeTimeBlock(blockIndex)}
            />
          ))}

          {formData.timeBlocks.length === 0 && (
            <p className="text-gray-500 text-sm">No time blocks. Add one to configure widgets.</p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>
    </form>
  );
}

function TimeBlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: TimeBlockConfig;
  onChange: (block: TimeBlockConfig) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-500">Block Type</label>
            <select
              value={block.name}
              onChange={(e) => onChange({ ...block, name: e.target.value as TimeBlock })}
              className="mt-1 block w-full rounded border-gray-300 text-sm"
            >
              <option value="morning">Morning</option>
              <option value="workday">Workday</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Start Time</label>
            <input
              type="time"
              value={block.startTime}
              onChange={(e) => onChange({ ...block, startTime: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">End Time</label>
            <input
              type="time"
              value={block.endTime}
              onChange={(e) => onChange({ ...block, endTime: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="ml-2 text-red-600 hover:text-red-500 text-sm"
        >
          Remove
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Widgets</label>
        <div className="flex flex-wrap gap-2">
          {widgetOptions.map((widget) => {
            const isSelected = block.widgets.some((w) => w.type === widget);
            return (
              <button
                key={widget}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onChange({
                      ...block,
                      widgets: block.widgets.filter((w) => w.type !== widget),
                    });
                  } else {
                    onChange({
                      ...block,
                      widgets: [
                        ...block.widgets,
                        { type: widget, priority: block.widgets.length + 1, enabled: true },
                      ],
                    });
                  }
                }}
                className={`px-2 py-1 rounded text-xs ${
                  isSelected
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {widget}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### 7.5 Create Token Health Page

Create `src/app/(admin)/admin/tokens/page.tsx`:

```typescript
import { connectToDatabase } from '@/lib/db/mongodb';
import { TokenHealth } from '@/lib/db/models/token';
import { checkPSNTokenHealth } from '@/lib/api/playstation';

export const dynamic = 'force-dynamic';

const serviceInfo: Record<string, { name: string; refreshUrl?: string }> = {
  psn: {
    name: 'PlayStation Network',
    refreshUrl: 'https://ca.account.sony.com/api/v1/ssocookie',
  },
  xbox: {
    name: 'Xbox Live (OpenXBL)',
    refreshUrl: 'https://xbl.io',
  },
  steam: {
    name: 'Steam',
    refreshUrl: 'https://steamcommunity.com/dev/apikey',
  },
  google: {
    name: 'Google Calendar',
  },
  tfnsw: {
    name: 'Transport NSW',
    refreshUrl: 'https://opendata.transport.nsw.gov.au',
  },
};

export default async function TokensPage() {
  await connectToDatabase();
  const tokens = await TokenHealth.find({}).lean();

  // Get fresh PSN status
  let psnStatus = null;
  try {
    psnStatus = await checkPSNTokenHealth();
  } catch (error) {
    console.error('PSN check failed:', error);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Token Health</h1>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {tokens.map((token) => {
            const info = serviceInfo[token.service];
            const isPSN = token.service === 'psn';
            const status = isPSN && psnStatus ? psnStatus.status : token.status;
            const message = isPSN && psnStatus ? psnStatus.message : token.errorMessage;

            return (
              <li key={token.service} className="px-4 py-5 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {info?.name || token.service}
                    </h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        Last checked:{' '}
                        {token.lastChecked
                          ? new Date(token.lastChecked).toLocaleString()
                          : 'Never'}
                      </span>
                      {token.errorCount > 0 && (
                        <span className="text-red-600">
                          {token.errorCount} errors
                        </span>
                      )}
                    </div>
                    {message && (
                      <p className="mt-1 text-sm text-yellow-600">{message}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusBadge status={status} />

                    {info?.refreshUrl && (
                      <a
                        href={info.refreshUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        Refresh →
                      </a>
                    )}
                  </div>
                </div>

                {/* PSN-specific info */}
                {isPSN && psnStatus?.expiresAt && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      NPSSO expires:{' '}
                      <span className="font-medium">
                        {new Date(psnStatus.expiresAt).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      To refresh: Sign in at playstation.com, then visit the refresh URL
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Refresh instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800">Token Refresh Instructions</h3>
        <div className="mt-2 text-sm text-blue-700">
          <p className="font-medium">PSN (PlayStation):</p>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Sign in at <a href="https://www.playstation.com" target="_blank" className="underline">playstation.com</a></li>
            <li>Visit <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" className="underline">SSO Cookie endpoint</a></li>
            <li>Copy the NPSSO token from the JSON response</li>
            <li>Update <code className="bg-blue-100 px-1 rounded">PSN_NPSSO</code> in Vercel environment variables</li>
            <li>Redeploy or wait for next refresh cycle</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: 'bg-green-100 text-green-800',
    expiring_soon: 'bg-yellow-100 text-yellow-800',
    expired: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
```

### 7.6 Create Routines Page

Create `src/app/(admin)/admin/routines/page.tsx`:

```typescript
import Link from 'next/link';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Routine } from '@/lib/db/models/routine';

export const dynamic = 'force-dynamic';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function RoutinesPage() {
  await connectToDatabase();
  const routines = await Routine.find({}).sort({ category: 1, name: 1 }).lean();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Routines</h1>
        <Link
          href="/admin/routines/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Add Routine
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {routines.map((routine) => (
            <li key={routine._id?.toString()}>
              <Link
                href={`/admin/routines/${routine._id}`}
                className="block hover:bg-gray-50"
              >
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {routine.name}
                      </p>
                      <span
                        className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          routine.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {routine.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="ml-2 shrink-0 flex">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded capitalize">
                        {routine.category}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        {routine.steps.length} steps
                      </p>
                      <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                        {routine.timeWindow.startTime} - {routine.timeWindow.endTime}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      {routine.recurrence.type === 'daily' ? (
                        <span>Daily</span>
                      ) : (
                        <span>
                          {routine.recurrence.daysOfWeek?.map((d) => dayNames[d]).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}

          {routines.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">
              No routines configured. Create one to get started.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
```

### 7.7 Create Admin API Routes

Create `src/app/api/admin/schedules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Schedule } from '@/lib/db/models/schedule';

export async function GET() {
  await connectToDatabase();
  const schedules = await Schedule.find({}).sort({ dayType: 1 });
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  await connectToDatabase();
  const schedule = await Schedule.create(body);

  return NextResponse.json(schedule, { status: 201 });
}
```

Create `src/app/api/admin/schedules/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Schedule } from '@/lib/db/models/schedule';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectToDatabase();
  const schedule = await Schedule.findById(params.id);

  if (!schedule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  await connectToDatabase();
  const schedule = await Schedule.findByIdAndUpdate(params.id, body, {
    new: true,
  });

  if (!schedule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectToDatabase();
  await Schedule.findByIdAndDelete(params.id);

  return NextResponse.json({ success: true });
}
```

### 7.8 Verify Setup

```bash
# Start dev server
pnpm dev

# Visit admin UI
open http://localhost:3000/admin

# Test pages
open http://localhost:3000/admin/schedules
open http://localhost:3000/admin/routines
open http://localhost:3000/admin/tokens
```

## Files Created

- `src/app/(admin)/layout.tsx`
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/schedules/page.tsx`
- `src/app/(admin)/admin/routines/page.tsx`
- `src/app/(admin)/admin/tokens/page.tsx`
- `src/components/admin/ScheduleEditor.tsx`
- `src/app/api/admin/schedules/route.ts`
- `src/app/api/admin/schedules/[id]/route.ts`

## Features Checklist

- [ ] Admin dashboard with stats
- [ ] Schedule listing and editing
- [ ] Routine listing and editing
- [ ] Token health monitoring
- [ ] PSN refresh instructions
- [ ] Dashboard preview link

## Security Note

The admin UI has no authentication in this implementation. For production use, consider adding:

- Basic auth via middleware
- OAuth with Google/GitHub
- API key protection for admin routes

## Next Step

Proceed to [Step 8: GitHub Actions](./08-github-actions.md) to set up scheduled data refresh.
