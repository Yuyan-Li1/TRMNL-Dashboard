# Step 9: Deployment

## Overview

Deploy the dashboard to Vercel and configure TRMNL to display it. This is the final step to get your custom dashboard running on your TRMNL device.

## ⚠️ MANUAL ACTION REQUIRED

This step requires manual configuration in multiple services.

---

## Part 1: Vercel Deployment

### 9.1 Create Vercel Project

1. Go to <https://vercel.com>
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Import your `trmnl-dashboard` repository
5. Configure the project:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `./` |
| Build Command | `pnpm build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |

### 9.2 Configure Environment Variables

In Vercel project settings, add all environment variables:

**Database & Cache:**

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

**Transport & Weather:**

| Variable | Description |
|----------|-------------|
| `TFNSW_API_KEY` | Transport NSW API key |

**Google Calendar:**

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_EMAIL` | Service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key (with `\n` for newlines) |
| `GOOGLE_CALENDAR_ID` | Calendar ID to display |

**Gaming APIs:**

| Variable | Description |
|----------|-------------|
| `STEAM_API_KEY` | Steam Web API key |
| `STEAM_ID` | Your Steam ID (64-bit) |
| `OPENXBL_API_KEY` | OpenXBL API key |
| `PSN_NPSSO` | PlayStation NPSSO token |

**Security:**

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Random string for GitHub Actions auth |

**App Config:**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (e.g., `https://trmnl-dashboard.vercel.app`) |

### 9.3 Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Note your deployment URL (e.g., `trmnl-dashboard.vercel.app`)

### 9.4 Verify Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Expected response:
# {"mongodb":true,"redis":true,"apis":{"weather":true,"transit":true,"calendar":true},"timestamp":"..."}

# Test dashboard loads
open https://your-app.vercel.app
```

---

## Part 2: GitHub Actions Setup

### 9.5 Add GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add repository secrets:

| Secret | Value |
|--------|-------|
| `VERCEL_URL` | Your Vercel deployment URL (without `https://`) |
| `CRON_SECRET` | Same value as in Vercel |

### 9.6 Enable Workflows

1. Go to Actions tab in your repository
2. If prompted, enable workflows
3. Manually trigger "Refresh Dashboard Data" to test

### 9.7 Verify Workflows

1. Watch the workflow execution
2. Check the refresh endpoint response
3. Verify data appears in your dashboard

---

## Part 3: TRMNL Configuration

### 9.8 Access TRMNL Dashboard

1. Go to <https://usetrmnl.com/dashboard>
2. Sign in with your TRMNL account

### 9.9 Create Custom Plugin

1. Click "Plugins" in the sidebar
2. Click "Private Plugin" or "Create Plugin"
3. Configure the plugin:

| Setting | Value |
|---------|-------|
| Name | Personal Dashboard |
| Type | Webpage |
| URL | `https://your-app.vercel.app` |
| Refresh Strategy | Webhook |

### 9.10 Configure Display Settings

1. Go to "Display" or "Screen" settings
2. Select your custom plugin
3. Configure refresh interval:

| Setting | Recommended Value |
|---------|-------------------|
| Refresh Interval | 30 minutes |
| Wake Time | 6:00 AM (or your preference) |
| Sleep Time | 11:00 PM (or your preference) |

### 9.11 Test Screenshot

1. In TRMNL dashboard, find "Preview" or "Test"
2. Click to capture a screenshot
3. Verify:
   - Page renders correctly
   - Text is readable
   - Layout fits 800×480
   - No JavaScript errors

---

## Part 4: Final Verification

### 9.12 Complete Checklist

**Vercel:**

- [ ] Project deployed successfully
- [ ] All environment variables configured
- [ ] Health endpoint returns healthy status
- [ ] Dashboard page loads correctly

**GitHub Actions:**

- [ ] Secrets configured
- [ ] Refresh workflow enabled
- [ ] First manual run successful
- [ ] Scheduled runs working

**TRMNL:**

- [ ] Custom plugin created
- [ ] URL configured correctly
- [ ] Preview screenshot looks correct
- [ ] Display settings configured

**Data Flow:**

- [ ] Weather data displays
- [ ] Transit data displays (if configured)
- [ ] Calendar events display (if configured)
- [ ] Gaming stats display (weekends)

### 9.13 Monitor Initial Operation

For the first 24 hours, monitor:

1. **GitHub Actions:** Watch for failed runs
2. **Vercel Logs:** Check for errors in Functions tab
3. **TRMNL Device:** Verify display updates
4. **Admin UI:** Check token health at `/admin/tokens`

---

## Troubleshooting

### Dashboard shows "No data"

1. Check if GitHub Actions ran successfully
2. Verify environment variables in Vercel
3. Check Vercel function logs for errors
4. Manually trigger a refresh

### TRMNL shows blank screen

1. Verify the URL is accessible publicly
2. Check TRMNL screenshot preview
3. Ensure page loads within 5 seconds
4. Check for JavaScript errors

### MongoDB connection errors

1. Verify IP whitelist includes `0.0.0.0/0`
2. Check connection string format
3. Verify username/password

### Redis connection errors

1. Check Upstash REST URL and token
2. Verify the database exists and is active

### PSN data not showing

1. Check if NPSSO token is expired
2. Visit `/admin/tokens` for status
3. Refresh token following the instructions

### Transit data 403 errors

1. Regenerate Transport NSW API key
2. Update environment variable
3. Redeploy

---

## Maintenance

### Regular Tasks

| Task | Frequency | How |
|------|-----------|-----|
| Check token health | Weekly | Visit `/admin/tokens` |
| Refresh PSN token | Every 2 months | Follow PSN refresh steps |
| Review GitHub Actions | Weekly | Check Actions tab |
| Update dependencies | Monthly | `pnpm update` |

### Updating the Dashboard

1. Make changes locally
2. Test with `pnpm dev`
3. Commit and push to GitHub
4. Vercel will auto-deploy

### Adding New Features

1. Create a new branch
2. Implement the feature
3. Test locally
4. Create a pull request
5. Merge to main
6. Vercel deploys automatically

---

## Cost Summary

This setup uses only free tiers:

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby | Free |
| MongoDB Atlas | M0 | Free |
| Upstash Redis | Free | Free |
| GitHub Actions | Free tier | Free |
| Open-Meteo | Free | Free |
| Transport NSW | Free | Free |
| Steam API | Free | Free |
| OpenXBL | Free | Free |
| PSN API | Free | Free |
| Google Calendar | Free | Free |

**Total: $0/month**

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Dashboard | `https://your-app.vercel.app` |
| Admin UI | `https://your-app.vercel.app/admin` |
| Preview | `https://your-app.vercel.app/preview` |
| Health Check | `https://your-app.vercel.app/api/health` |
| Token Status | `https://your-app.vercel.app/api/tokens` |

### Environment Variables

```env
# Database
MONGODB_URI=mongodb+srv://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# APIs
TFNSW_API_KEY=...
STEAM_API_KEY=...
STEAM_ID=...
OPENXBL_API_KEY=...
PSN_NPSSO=...

# Google
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN..."
GOOGLE_CALENDAR_ID=...

# Security
CRON_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### GitHub Secrets

```text
VERCEL_URL=your-app.vercel.app
CRON_SECRET=<same as Vercel>
```

---

## Congratulations

Your custom TRMNL dashboard is now deployed and running. The dashboard will:

- Refresh data every 15 minutes via GitHub Actions
- Display context-aware widgets based on day type and time
- Show weather, transit, calendar, and gaming information
- Alert you to special conditions (rain, delays, meetings)
- Monitor API token health and warn before expiration

For questions or issues, refer back to the documentation or check the [CLAUDE.md](../CLAUDE.md) file for AI agent instructions.

---

## Documentation Index

- [Step 0: Project Setup](./00-project-setup.md)
- [Step 1: Database Setup](./01-database-setup.md)
- [Step 2: Core API Integrations](./02-core-api-integrations.md)
- [Step 3: Gaming Integrations](./03-gaming-integrations.md)
- [Step 4: Schedule System](./04-schedule-system.md)
- [Step 5: Widget System](./05-widget-system.md)
- [Step 6: Dashboard Renderer](./06-dashboard-renderer.md)
- [Step 7: Admin UI](./07-admin-ui.md)
- [Step 8: GitHub Actions](./08-github-actions.md)
- **[Step 9: Deployment](./09-deployment.md)** (You are here)
