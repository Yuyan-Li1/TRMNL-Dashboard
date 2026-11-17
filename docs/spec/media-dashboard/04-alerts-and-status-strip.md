# Stage 4: Alerts and status strip

Read [the overview](README.md) first. This stage adds Telegram Alerts from Vercel, the status strip and the source health page, and deletes the GitHub issue workflows. Nothing changes on the panel. The Telegram code is written so the Collector can share it in stage 5.

## Owner's setup

- Create one bot with BotFather, message it from the owner's private chat, and add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to Vercel.

## Slices

### 1. Refresh bookkeeping

- The refresh writes to Redis its last-success time and, per source, the last good read time and the count of failed runs in a row.
- A source is Stale when its last good read is older than expected. Its last good data stays on screen.

### 2. Alerts

A single failed run is silent.

| Failure                                                                                                     | Alerts after                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------- |
| A source or Catalog read on the 15-minute refresh (Steam, Xbox, PSN, Switch, Trakt, Letterboxd, TMDB, IGDB) | 4 failed runs in a row (1 hour) |
| A token rejected (PSN, Nintendo, Trakt)                                                                     | Immediately                     |

- **Tokens close to expiry** warn 14 days before and again 3 days before:
  - PSN NPSSO: 60 days. The refresh stores a fingerprint of the token and the day the fingerprint changes; expiry is 60 days after that day. No hand-set date.
  - Nintendo session token: valid to 2028-11-16.
  - Trakt client id: no expiry, rejection only.
- **Repeats and recovery**: one message when a failure starts, a reminder every 24 hours while it lasts, one "recovered" message when it clears. State is one Redis key per failure under `alert:`.
- **Time of day**: any hour, with sound. No quiet hours, no queue.
- **Format**: one short message with the sender (`[vercel]`), what failed, since when, and a one-line fix where one exists. A reminder repeats it with the duration ("for 2 days"). Recovery is one line: "[vercel] PSN recovered after 2 days".
- **Redis unreachable**: Vercel sends at most one "Redis unreachable" message per refresh.
- **Telegram failing**: the send is retried on the next run, and the failure shows on the status strip and the source health page.
- Both sides down at once sends nothing. Nothing more is built for that.

### 3. Status strip

- A strip on the dashboard page below the 800x480 area the device captures: visible in a browser without a login, never on the panel.
- It shows each source's last good read time (marked Stale where it applies), the last refresh time, and the last Alert sent with whether the send succeeded. Times and source names only.
- It carries the attribution lines for TMDB (notice and logo) and IGDB.
- The home server's heartbeat is added to it in stage 5.

### 4. Source health page

- A plain table in the admin area: each source and token, its last good read, failures in a row, the token's expiry date where it has one, and a button that sends a test Alert.

### 5. Remove the old checks

- Delete `health-check.yml`, `token-expiry.yml` and `/api/tokens`. `/api/health` stays, checking Redis.

## Check

- The owner receives the test Alert, and a deliberately broken source produces a start message after an hour and a recovery message when fixed.
