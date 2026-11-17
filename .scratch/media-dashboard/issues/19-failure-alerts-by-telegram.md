# Failure alerts by Telegram

Type: grilling
Assignee: Yuyan Li
Status: resolved

## Question

The owner wants a Telegram bot to send a message whenever something breaks. How do failure alerts work?

- **What counts as "something breaks"**: a source read failing, a token expired or close to expiry (PSN, Nintendo, Trakt, Claude Code), the home server unreachable, the Vercel refresh failing, the daily LLM run failing. Decide which of these alert and after how long.
- **Who sends the message**: Vercel, the home server, or both, given that either can be the thing that is down.
- **Repeats**: how a failure that persists is kept from sending a message on every run, and whether recovery sends a message.
- **GitHub issues**: whether Telegram replaces the issues that `health-check.yml` and `token-expiry.yml` create today, or runs beside them.
- **Setup**: the bot token and chat id, and where they are kept.

Already decided in [How Goodreads is read](06-how-goodreads-is-read.md): a failed Goodreads read (a request error, or a shelf that had books parsing to none) raises an alert.

## Answer

Resolved 2026-11-17 with the owner.

- **Who sends**: each side sends its own alerts straight to Telegram and watches the other.
  - The home server alerts on its own jobs (Goodreads, the Letterboxd following list, the daily LLM run).
  - Vercel's refresh alerts on its own sources (Steam, Xbox, PSN, Switch, Trakt, the Catalogs).
  - The home server writes a heartbeat to Redis on every run; Vercel alerts when it is stale.
  - Vercel's refresh writes its last-success time to Redis; the home server alerts when it is stale. This also catches a disabled GitHub Actions cron.
- **What alerts, and after how long**: a single failed run is silent.

  | Failure | Alerts after |
  |---|---|
  | Source read on the 15-minute Vercel refresh | 4 failed runs in a row (1 hour) |
  | Goodreads or Letterboxd read on the home server (6-hourly) | 2 failed reads in a row (12 hours) |
  | Daily LLM run | 1 failed run |
  | Token rejected (PSN, Nintendo, Trakt, Claude Code) | Immediately |
  | Home server heartbeat stale | 1 hour |
  | Vercel refresh stale | 1 hour |

- **Tokens close to expiry**: a token with a known expiry date warns 14 days before and again 3 days before. A rejected token always alerts, as the backstop.
  - Claude Code token: one year from `claude setup-token`.
  - Nintendo session token: valid to 2028-11-16.
  - PSN NPSSO: 60 days. Sony's response carries `expires_in` of 5183976 seconds, confirmed by the owner on 2026-11-17. The refresh stores a fingerprint of the token in Redis and records the day the fingerprint changes; expiry is 60 days after that day. No hand-set date variable.
  - Trakt client id: no expiry, rejection only.
- **Repeats and recovery**: one message when a failure starts, a reminder every 24 hours while it lasts, one "recovered" message when it clears. State is one Redis key per failure, shared by both senders.
- **Time of day**: alerts are sent at any hour, with sound. No quiet hours and no queue.
- **Message format**: one short message with the sender (`[vercel]` or `[home]`), what failed, since when, and a one-line fix where one exists. Reminders repeat it with the duration ("for 2 days"); recovery is one line ("[vercel] PSN recovered after 2 days").
- **GitHub issues**: Telegram replaces them. `health-check.yml` and `token-expiry.yml` are deleted.
- **Setup**: one bot from BotFather messaging the owner's private chat. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` live in Vercel's environment variables and in the collector's env file on the home server.
- **Testing**: a test alert can be sent from each side: a button on the admin page for Vercel, a command on the home server.
- **Accepted gaps**: nothing more is built for these.
  - Both sides down at once: no alert.
  - Redis unreachable: the side that notices still alerts. Without repeat state, the home server keeps the last-sent time in memory and Vercel sends at most one "Redis unreachable" message per refresh.
  - Telegram failing: the send is retried on the next run and the failure shows on the status strip and the source health page.
- **Status strip**: the dashboard page shows a strip below the 800x480 area the device captures, visible in a browser without a login and never on the panel. It shows each source's last good read time (marked Stale where it applies), the last Vercel refresh time, the home server's last heartbeat, and the last alert sent with whether the send succeeded. Times and source names only. The source health page in the admin area stays as the fuller view (tokens, expiry dates, the test button).
- **Glossary**: **Alert** and **Stale** added to `GLOSSARY.md`.

## Comments

- 2026-11-17, from [Home collector design](13-home-collector-design.md): the collector is a short command with no process alive between runs, so its last-sent time for when Redis is unreachable is kept in SQLite, not in memory.
