# Stage 5: Collector and books

Read [the overview](README.md) first. This stage sets up the Collector on the home server and uses it to bring books from Goodreads onto the screen. Any source that failed its reachability check in stage 1 or 2 (Switch, Letterboxd) is also read by the Collector here.

## The home server as found

- An Intel MacBook Pro on macOS 15.7.3, kept awake by Plex, reached with `ssh homeserver`.
- Python 3.10, `sqlite3` and `git` are installed. Node, pnpm and the Claude Code CLI are not.
- Nothing on it is backed up today.

## Owner's setup, in one sitting

The stage opens with one guided checklist, built as an interactive script the owner runs:

1. Install Node 20 or later and pnpm.
2. Clone this repo and install dependencies.
3. Create `~/trmnl-collector/` (readable only by the owner) with `.env`: the Upstash credentials, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GOODREADS_USER_ID`, the dashboard URL and `CRON_SECRET`.
4. Install the Claude Code CLI, run `claude setup-token`, add the result to `.env` as `CLAUDE_CODE_OAUTH_TOKEN`, and run one trivial `claude -p` to confirm it works on the Intel Mac. LLM picks arrive only in stage 8; this is done now because it is the one untested fact stage 8 rests on. No `ANTHROPIC_API_KEY` may be present.
5. Install the launchd job.
6. Run `collector test-alert`.

If step 4 fails, the stage still ships and stage 8 is reconsidered.

## Slices

### 1. Collector skeleton

- TypeScript in this repo, in `collector/`, run by Node. It shares the Redis key names, the Title types and the Telegram code with the Vercel app. SQLite is Node's built-in `node:sqlite`.
- **`collector tick`**, started by launchd every 15 minutes as a LaunchDaemon running as the owner's user, so it starts after a reboot with no login. No process stays alive between ticks. Each tick:
  1. writes the heartbeat and `home:status` to Redis;
  2. checks the Vercel refresh: if its last success is more than 30 minutes old, the tick calls `POST /api/refresh` itself; if more than 1 hour old, it raises an Alert;
  3. runs whichever jobs are due according to SQLite;
  4. sends its Alerts straight to Telegram before it exits.
- **SQLite is the Collector's record** (`~/trmnl-collector/collector.db`): in this stage, the day each Goodreads book was first seen as read, per-job schedule and failure counts, Alert repeat state, and the Claude Code token's fingerprint. Redis can be rebuilt from it at any time.
- **`home:status`**, rewritten every tick: the heartbeat time, the running commit, the Claude Code token's expiry date, and for each job the last attempt, the last success and the failures in a row.

| Job in this stage | When |
|---|---|
| Goodreads read | Every 6 hours |
| Code update | Daily at 03:30 Sydney |
| Snapshot | Nightly |

- **Code update**: pull `main` (fast-forward only) and reinstall dependencies if the lockfile changed. A failed pull raises an Alert and the old code keeps running.
- **Snapshot**: a consistent copy of the database (and, from later stages, the taste models and "also consumed" files). Keep the last 14 on disk and store the newest, compressed, in `home:backup`.

| Command run by hand | What it does |
|---|---|
| `collector publish` | Rewrites every `home:` key from SQLite |
| `collector restore` | Rebuilds SQLite and the text files from the snapshot in Redis or on disk |
| `collector test-alert` | Sends a test Alert |
| `collector run <job>` | Runs one job now, ignoring its schedule |

### 2. Alerts on both sides

- The Collector's Alerts follow stage 4's rules for repeats, recovery and format, with the sender `[home]`.

| Failure | Sent by | Alerts after |
|---|---|---|
| Goodreads read | Collector | 2 failed reads in a row (12 hours) |
| Vercel refresh Stale | Collector | 1 hour |
| Home server heartbeat Stale | Vercel | 1 hour |
| Claude Code token rejected | Collector | Immediately |

- **Claude Code token expiry**: one year after the day the Collector first sees the token's fingerprint or sees it change. Alerts 14 and 3 days ahead.
- When Redis is unreachable the Collector still alerts, keeping the last-sent time in SQLite.
- The status strip and the source health page now also show the home server's heartbeat, the Collector's jobs and the Claude Code token's expiry, read from `home:status`.

### 3. Goodreads read

No login. Every 6 hours, from the home connection:

- **Read shelf**: `/review/custom_widget/<id>?shelf=read&sort=date_read&order=d&num_books=100`. Gives title, first author, cover, the owner's star rating and the review id.
- **Currently-reading shelf**: the same widget with `shelf=currently-reading`.
- **Progress**: `/user_status/list/<id>`, giving "page X of Y" or "N% done" with timestamps.
- **Cache trap**: the widget is cached server-side on the id and `widget_id`, and other parameters are ignored on a hit. Send a distinct `widget_id` for each query.
- **Covers**: rewrite the size suffix to `._SY600_.` (about 397x600). It never upscales.
- **Description and average rating**, for the Spotlight: from Goodreads' `/book/show` structured data or the `/tooltips` endpoint, fetched once per book and kept in SQLite. Book pages can return bot challenges under load, so fetch one at a time.
- **Finish date**: the day the Collector first sees a book's review id on the read shelf. On the very first run every book already there is recorded with no finish date, so none appears as Finished.
- **A read has failed** when a request errors or when a shelf that previously had books parses to none. The Collector keeps the last good data, records nothing as newly finished, and marks Goodreads Stale.
- Accepted limits: a reread is not detected as newly Finished; a rating added later appears on the next read without making the book Finished again.
- The Collector publishes the books under `home:`. Vercel dithers the covers during its refresh, as for every other medium.

### 4. Books on the screen

- **In progress**: on the currently-reading shelf. Its freshness is the latest progress update. With none in 14 days it is not eligible for the Spotlight but still shows on the books Medium card with its last known progress.
- **Finished**: first seen as read, eligible for 14 days from that day.
- **A book in the Spotlight**: Mode label with "Book"; title; byline is the author; the owner's stars with "You" when Finished and rated; facts are "Page X of Y" or "N%" and when, or when it was finished; a progress bar when In progress; then the Goodreads description.
- **The books Medium card**: thumbnail, title, the owner's stars when rated, page of pages, and when.

## If the Goodreads widget is retired

Books freeze on their last good data. No second no-login route is built; see "Not in this spec" in the overview.

## Device check

- A book in the Spotlight and the books Medium card read well on the panel.
- After a reboot of the home server the tick resumes without a login.
