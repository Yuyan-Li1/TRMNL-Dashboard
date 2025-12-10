# Step 8: GitHub Actions

## Overview

Set up GitHub Actions to trigger data refresh every 15 minutes. This is a workaround for Vercel Hobby plan's cron limitations (only 2 cron jobs, once per day each).

## Why GitHub Actions?

| Feature | Vercel Hobby | GitHub Actions |
|---------|--------------|----------------|
| Cron jobs | 2 max | Unlimited |
| Frequency | Once per day | Every 5 minutes min |
| Cost | Free | Free (2,000 min/month) |
| Execution | 60s timeout | 6h timeout |

With GitHub Actions running every 15 minutes:

- ~96 runs per day
- ~2,880 runs per month
- Well under the 2,000 minute limit (each run takes ~30 seconds)

---

## ⚠️ MANUAL ACTION REQUIRED

### 8.1 Generate CRON_SECRET

Generate a secure random string for authenticating cron requests:

```bash
# On macOS/Linux
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Save this value** - you'll need it for both Vercel and GitHub.

### 8.2 Add GitHub Repository Secret

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Name | Value |
|------|-------|
| `CRON_SECRET` | Your generated secret |
| `VERCEL_URL` | Your Vercel deployment URL (e.g., `trmnl-dashboard.vercel.app`) |

---

## Implementation

### 8.3 Create Refresh Workflow

Create `.github/workflows/refresh.yml`:

```yaml
name: Refresh Dashboard Data

on:
  # Run every 15 minutes
  schedule:
    - cron: '*/15 * * * *'

  # Allow manual trigger
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Trigger data refresh
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "https://${{ secrets.VERCEL_URL }}/api/refresh" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Response: $body"
          echo "HTTP Status: $http_code"

          # Check if successful (200, 206, or 207)
          if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo "Refresh successful"
          else
            echo "Refresh failed with status $http_code"
            exit 1
          fi

      - name: Log result
        if: always()
        run: |
          echo "Refresh completed at $(date -u)"
```

### 8.4 Create Morning Data Pre-fetch Workflow

Create `.github/workflows/morning-prefetch.yml`:

```yaml
name: Morning Data Pre-fetch

on:
  schedule:
    # Run at 6:00 AM Sydney time (UTC+11 in summer, UTC+10 in winter)
    # Using UTC time - adjust for your timezone
    - cron: '0 19 * * 1-5'  # ~6 AM AEDT (Mon-Fri)
    - cron: '0 20 * * 1-5'  # ~6 AM AEST (Mon-Fri, during standard time)

  workflow_dispatch:

jobs:
  prefetch:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Pre-fetch morning data
        run: |
          echo "Pre-fetching data for morning dashboard..."

          # Trigger refresh
          curl -s -X POST \
            "https://${{ secrets.VERCEL_URL }}/api/refresh" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

          # Wait a moment and trigger again to warm caches
          sleep 30
          curl -s -X POST \
            "https://${{ secrets.VERCEL_URL }}/api/refresh" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

          echo "Morning pre-fetch complete"
```

### 8.5 Create Health Check Workflow

Create `.github/workflows/health-check.yml`:

```yaml
name: Health Check

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'

  workflow_dispatch:

jobs:
  health:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Check dashboard health
        id: health
        run: |
          response=$(curl -s -w "\n%{http_code}" \
            "https://${{ secrets.VERCEL_URL }}/api/health")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Health response: $body"
          echo "HTTP Status: $http_code"

          # Parse JSON for individual service status
          echo "health_status=$http_code" >> $GITHUB_OUTPUT
          echo "response=$body" >> $GITHUB_OUTPUT

          if [ "$http_code" != "200" ]; then
            echo "Health check failed"
            exit 1
          fi

      - name: Check token health
        run: |
          response=$(curl -s "https://${{ secrets.VERCEL_URL }}/api/tokens")
          echo "Token health: $response"

          # Check for warnings
          has_warnings=$(echo "$response" | grep -o '"hasWarnings":true' || true)
          if [ -n "$has_warnings" ]; then
            echo "::warning::Token health warnings detected"
          fi

      - name: Create issue on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const title = 'Dashboard Health Check Failed';
            const body = `
            ## Health Check Failed

            The dashboard health check failed at ${new Date().toISOString()}.

            Please check:
            - MongoDB connection
            - Redis connection
            - API credentials

            [View Health Endpoint](https://${{ secrets.VERCEL_URL }}/api/health)
            `;

            // Check if issue already exists
            const issues = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'health-check-failure'
            });

            if (issues.data.length === 0) {
              await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title,
                body,
                labels: ['health-check-failure', 'automated']
              });
            }
```

### 8.6 Create Token Expiry Check Workflow

Create `.github/workflows/token-expiry.yml`:

```yaml
name: Token Expiry Check

on:
  schedule:
    # Run daily at 9 AM UTC
    - cron: '0 9 * * *'

  workflow_dispatch:

jobs:
  check-tokens:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Check token expiry
        id: tokens
        run: |
          response=$(curl -s "https://${{ secrets.VERCEL_URL }}/api/tokens")
          echo "Token response: $response"

          # Check for expiring tokens
          expiring=$(echo "$response" | grep -o '"status":"expiring_soon"' || true)
          expired=$(echo "$response" | grep -o '"status":"expired"' || true)

          if [ -n "$expired" ]; then
            echo "has_expired=true" >> $GITHUB_OUTPUT
            echo "::error::One or more tokens have expired"
          fi

          if [ -n "$expiring" ]; then
            echo "has_expiring=true" >> $GITHUB_OUTPUT
            echo "::warning::One or more tokens are expiring soon"
          fi

      - name: Create issue for expired tokens
        if: steps.tokens.outputs.has_expired == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const title = '🚨 API Token Expired';
            const body = `
            ## Token Expiration Alert

            One or more API tokens have expired and need to be refreshed.

            ### Common Causes
            - PSN NPSSO token (expires every ~2 months)
            - API key invalidated

            ### Resolution
            1. Visit the [Token Health page](https://${{ secrets.VERCEL_URL }}/admin/tokens)
            2. Follow the refresh instructions for the expired token
            3. Update environment variables in Vercel
            4. Redeploy if needed

            ---
            *This issue was automatically created by the token expiry check workflow.*
            `;

            const issues = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'token-expired'
            });

            if (issues.data.length === 0) {
              await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title,
                body,
                labels: ['token-expired', 'urgent', 'automated']
              });
            }

      - name: Create issue for expiring tokens
        if: steps.tokens.outputs.has_expiring == 'true' && steps.tokens.outputs.has_expired != 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const title = '⚠️ API Token Expiring Soon';
            const body = `
            ## Token Expiration Warning

            One or more API tokens will expire soon and should be refreshed.

            ### Action Required
            1. Visit the [Token Health page](https://${{ secrets.VERCEL_URL }}/admin/tokens)
            2. Check which tokens are marked as "expiring soon"
            3. Follow the refresh instructions before they expire

            ---
            *This issue was automatically created by the token expiry check workflow.*
            `;

            const issues = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'token-expiring'
            });

            if (issues.data.length === 0) {
              await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title,
                body,
                labels: ['token-expiring', 'automated']
              });
            }
```

### 8.7 Update API Refresh Endpoint

Update `src/app/api/refresh/route.ts` to handle GitHub Actions better:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { refreshAllData } from '@/lib/api/refresh';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/refresh
 * Triggers a refresh of all cached data
 * Called by GitHub Actions every 15 minutes
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify authorization
  const authHeader = request.headers.get('Authorization');
  const userAgent = request.headers.get('User-Agent') || '';

  if (!CRON_SECRET) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  // Check authorization
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('Unauthorized refresh attempt', {
      userAgent,
      authProvided: !!authHeader,
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting data refresh...', {
      userAgent,
      timestamp: new Date().toISOString(),
    });

    const data = await refreshAllData();
    const duration = Date.now() - startTime;

    const hasErrors = data.errors.length > 0;

    console.log('Refresh completed', {
      duration: `${duration}ms`,
      errors: data.errors,
    });

    return NextResponse.json({
      success: !hasErrors,
      refreshedAt: data.refreshedAt,
      duration: `${duration}ms`,
      errors: data.errors,
      summary: {
        weather: data.weather ? 'OK' : 'FAILED',
        transit: data.transit ? 'OK' : 'FAILED',
        calendar: data.calendar ? 'OK' : 'FAILED',
        gaming: data.gaming ? 'OK' : 'FAILED',
      },
    }, {
      status: hasErrors ? 207 : 200,  // 207 = Multi-Status (partial success)
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Refresh failed:', error);

    return NextResponse.json(
      {
        error: 'Refresh failed',
        details: String(error),
        duration: `${duration}ms`,
      },
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
    cronConfigured: !!CRON_SECRET,
  });
}
```

### 8.8 Create Workflow Status Badge

Add to your `README.md`:

```markdown
## Status

[![Refresh Data](https://github.com/YOUR_USERNAME/trmnl-dashboard/actions/workflows/refresh.yml/badge.svg)](https://github.com/YOUR_USERNAME/trmnl-dashboard/actions/workflows/refresh.yml)
[![Health Check](https://github.com/YOUR_USERNAME/trmnl-dashboard/actions/workflows/health-check.yml/badge.svg)](https://github.com/YOUR_USERNAME/trmnl-dashboard/actions/workflows/health-check.yml)
```

### 8.9 Verify Setup

1. **Push workflows to GitHub:**

  ```bash
  git add .github/workflows/
  git commit -m "Add GitHub Actions workflows"
  git push
  ```

2. **Check Actions tab:**
   - Go to your repository on GitHub
   - Click "Actions" tab
   - You should see the workflows listed

3. **Test manual trigger:**
   - Click on "Refresh Dashboard Data"
   - Click "Run workflow" → "Run workflow"
   - Watch the execution

4. **Verify refresh endpoint:**

```bash
# Test locally (replace with your URL)
curl -X POST https://your-app.vercel.app/api/refresh \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Files Created

- `.github/workflows/refresh.yml`
- `.github/workflows/morning-prefetch.yml`
- `.github/workflows/health-check.yml`
- `.github/workflows/token-expiry.yml`
- `src/app/api/refresh/route.ts` (updated)

## Workflow Schedule Reference

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| refresh | Every 15 min | Keep data fresh |
| morning-prefetch | 6 AM weekdays | Warm caches for morning |
| health-check | Every 6 hours | Monitor system health |
| token-expiry | Daily 9 AM | Check for expiring tokens |

## Troubleshooting

### Workflow not running

1. Check that secrets are set correctly in GitHub
2. Verify the YAML syntax is valid
3. Check Actions are enabled for the repository

### 401 Unauthorized errors

1. Verify `CRON_SECRET` matches in both Vercel and GitHub
2. Check the Authorization header format: `Bearer YOUR_SECRET`

### Workflow timing

GitHub Actions cron uses UTC time. Convert your local time:

| Sydney Time | UTC (Summer) | UTC (Winter) |
|-------------|--------------|--------------|
| 6:00 AM | 19:00 (prev day) | 20:00 (prev day) |
| 12:00 PM | 01:00 | 02:00 |
| 6:00 PM | 07:00 | 08:00 |

### Rate limits

GitHub Actions provides:

- 2,000 minutes/month for free accounts
- 3,000 minutes/month for Pro accounts

With 4 workflows running ~100 times/month each at ~30 seconds:

- Estimated usage: ~200 minutes/month
- Well under the limit

## Next Step

Proceed to [Step 9: Deployment](./09-deployment.md) to deploy to Vercel and configure TRMNL.
