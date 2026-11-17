# Home collector design

Type: grilling
Blocked by: 06, 08, 18, 19
Assignee: Yuyan Li
Status: resolved

## Question

What exactly runs on the home server, and how does it hand data to the dashboard?

- Which jobs it runs and how often: Goodreads, the Letterboxd following list, the daily LLM recommendations, and anything else Vercel cannot reach.
- Whether it shares code with this repo or is a separate small program, and how it is scheduled and kept running.
- How it writes to Redis and which keys it owns, so Vercel's refresh never overwrites them.
- Where its secrets live, and how the dashboard learns that a collector job is failing or stale.

## Answer

Resolved 2026-11-17 by grilling with the owner. **Collector** was added to `GLOSSARY.md`.

### The home server as found

- An Intel MacBook Pro on macOS 15.7.3 with 58 GB free, kept awake by Plex.
- Python 3.10, `sqlite3` and `git` are installed. Node, pnpm, Docker and the Claude Code CLI are not.
- It has no Time Machine destination of its own, so nothing on it is backed up today.

### Code and scheduling

- **Code**: TypeScript in this repo, in a `collector/` folder, run by Node on the home server. It shares the Redis key names, the Title types and the Trakt, IGDB and Telegram code with the Vercel app. SQLite is Node's built-in `node:sqlite`.
- **Scheduling**: a short command, `collector tick`, started by launchd every 15 minutes as a LaunchDaemon running as the owner's user, so it starts after a reboot with no login. Each tick:
  - writes the heartbeat and `home:status` to Redis;
  - checks that the Vercel refresh is not Stale;
  - merges the consumed set (below);
  - runs whichever jobs are due according to SQLite.
- **Jobs**:

  | Job                       | When                  |
  | ------------------------- | --------------------- |
  | Goodreads read            | Every 6 hours         |
  | Letterboxd following list | Every 6 hours         |
  | Code update               | Daily at 03:30 Sydney |
  | LLM check, per medium     | Daily at 04:00 Sydney |
  | Snapshot                  | Nightly               |

- **Alerts**: each tick sends its Alerts straight to Telegram before it exits. The rules in [Failure alerts by Telegram](19-failure-alerts-by-telegram.md) are unchanged except one detail: the last-sent time kept "in memory" for when Redis is unreachable is a row in SQLite, because no process stays alive between ticks.
- **Code update**: the collector pulls `main` (fast-forward only), reinstalls dependencies if the lockfile changed, and copies the run-folder templates into place. A failed pull raises an Alert and the old code keeps running.

### Storage

- **SQLite is the collector's record** (`collector.db`): the consumed set, the film-to-TMDB map, the day each Goodreads book was first seen as read, every title recommended before, the change-detection log, per-job schedule and failure counts, alert repeat state, resolved "also consumed" lines and token fingerprints.
- **Redis is the only thing Vercel reads** and can be rebuilt from SQLite at any time.
- **Key ownership**: every key the collector writes starts with `home:`, and Vercel never writes under that prefix. The collector never writes outside it. Each side may read the other's keys. The one exception is the per-failure alert state under `alert:`, written by both. Both sides use the same Upstash credentials.
- **Snapshot**: once a night the collector takes a consistent snapshot of the database, the taste models and the "also consumed" files. It keeps the last 14 on the server's disk and stores the newest, compressed, in the Redis key `home:backup`.

### The consumed set

- **The collector is the single owner.** Vercel's refresh writes each source's full history (Steam, Xbox, PSN, Switch, Trakt, the owner's Letterboxd feed) to its own Redis keys. On each tick the collector reads them, merges them into SQLite with the exports and the "also consumed" files, and publishes one consumed set per medium under `home:`.
- Vercel checks Catalog picks against the published set. The collector checks LLM picks against SQLite.
- A newly Consumed title can take up to 15 minutes to reach the set. This is accepted, because a pick already leaves the Pool when the title appears in the owner's activity.
- **Games**: a game is Consumed with 30 minutes or more of play, or with any trophy or achievement earned. An entry with no play time recorded (the Xbox `Win32` entries, trophy-only PSN titles) counts as Consumed. A game below the threshold can still be recommended.
- **"Also consumed" files**: one text file per medium, one title per line, optionally followed by a year or an author. The collector looks each new line up in the medium's Catalog once and stores the id. A line it cannot match raises one Alert naming the line and is retried only when the line is edited.

### The LLM run

- **Run folders**: one per medium on the home server, outside the repo: `~/trmnl-collector/llm-run/games/`, `books/`, `movies/` and `shows/`. Each holds:
  - `taste.md`, the owner's taste model, the only file the owner edits. A medium without one runs on history alone.
  - a generated `CLAUDE.md` with the shared rules for a pick (the 100-character reason, the platform and language limits) that imports `taste.md`.
  - `.claude/settings.json` with the hook.
- The repo holds only the templates for `CLAUDE.md`, the settings file and the hook script. The repo is public, so taste models never enter git.
- **The prompt** carries only the data that changes: the last 50 titles with ratings and play time, and every title recommended before.
- **Invocation**: one `claude -p` call per changed medium, one after another, with `--output-format json`, `--json-schema`, `--tools "WebSearch,WebFetch"`, `--allowedTools "WebSearch,WebFetch"` and `--permission-mode dontAsk`. No `--bare`. Claude has no file or shell access. Tool allowances go on the command line, because permission rules in a project settings file are ignored in an untrusted folder. No `ANTHROPIC_API_KEY` may be in the job's environment, since it would take precedence over the subscription token.
- **The 100-character reason**: a `PreToolUse` hook on the `StructuredOutput` tool rejects any reason over 100 characters, and Claude shortens it in the same run. The collector still drops any pick that arrives over length. The schema's `maxLength` is not relied on.
- **Change detection**: the collector fingerprints the prompt data, `taste.md` and the "also consumed" file per medium. The rules for when a run happens are those in [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md).
- **Confirmation**: the collector confirms all four media (Trakt search for movies and shows, IGDB for games, Goodreads for books) and publishes only confirmed picks, each with its Catalog id and reason. Vercel fetches artwork, rating and description by id, so TMDB is called only from Vercel.

### Tested on 2026-11-17 (owner's Mac, Claude Code 2.1.326)

- A `PreToolUse` hook on `StructuredOutput` saw reasons of 152 and 150 characters, rejected them, and the run returned reasons of 89 and 86 characters.
- A `PostToolUse` hook fired but did not work: the over-length reasons were returned anyway.
- Structured output was still produced under `--tools "WebSearch,WebFetch"` with `--permission-mode dontAsk`.
- Each trivial run reported a notional cost of about $1.03 to $1.13, counted against the Max limits.
- From the documentation, not tested: project hooks and `CLAUDE.md` load in `-p` mode without a trust prompt; Claude Code installs on an Intel Mac without Node.

### Files, secrets and commands

- **`~/trmnl-collector/`** on the home server, readable only by the owner:
  - `.env`: Upstash, Telegram, Trakt and IGDB credentials and `CLAUDE_CODE_OAUTH_TOKEN`.
  - `collector.db`.
  - `llm-run/` (above).
  - `also-consumed/`: one text file per medium.
  - `exports/`: the Letterboxd and Goodreads exports and the film-to-TMDB map, for seeding.
  - `logs/` and the snapshots.
- The owner edits `taste.md` and the "also consumed" files over SSH or with `scp`. Nothing more convenient is built.
- **Claude Code token expiry**: the collector stores a fingerprint of the token and the day it first appears or changes. Expiry is one year after that day, with Alerts 14 and 3 days ahead.
- **`home:status`**, rewritten every tick, is what Vercel shows on the status strip and the source health page: the heartbeat time, the running commit, the Claude Code token's expiry date, and for each job the last attempt, the last success and the count of failures in a row.
- **Commands run by hand**:

  | Command                | What it does                                                                        |
  | ---------------------- | ----------------------------------------------------------------------------------- |
  | `collector seed`       | One-off: loads the exports and the film-to-TMDB map into SQLite. Safe to run twice. |
  | `collector publish`    | Rewrites every `home:` key from SQLite.                                             |
  | `collector restore`    | Rebuilds SQLite and the text files from the snapshot in Redis or on disk.           |
  | `collector test-alert` | Sends a test Alert to Telegram.                                                     |
  | `collector run <job>`  | Runs one job now, ignoring its schedule.                                            |

## Comments

- 2026-11-17, from [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md), the collector also has to cover:
  - Goodreads as the book Catalog: confirming LLM-named books and fetching rating, description and cover.
  - The LLM run per medium with web search, its change-detection log, and where the taste models and hand-edited "also consumed" lists are kept.
  - Asking for 10 picks, checking them against the consumed set in Redis, and enforcing the 100-character reason limit (a Claude Code hook or a check in the collector).
  - Seeding the consumed set from the exports in [Export history for the consumed set](18-export-history-for-the-consumed-set.md).
- 2026-11-17, raised by the owner after [Export history for the consumed set](18-export-history-for-the-consumed-set.md): keep a local SQLite database on the home server. Proposed, not yet decided:
  - SQLite is the collector's record: the consumed set, the film-to-TMDB id map, the day each Goodreads book was first seen as read, every title recommended before, and the change-detection log.
  - Redis stays the only thing Vercel reads. The collector publishes to it from SQLite, including whatever part of the consumed set Vercel needs to check Catalog picks, so Redis can be rebuilt at any time.
  - Taste models and the hand-edited "also consumed" lists stay as plain text files, read into the check at run time.
  - To settle: whether Vercel-side sources (Steam, Xbox, PSN, Switch, Trakt) reach the SQLite consumed set by the collector reading Redis, and how the database file is backed up.
- 2026-11-17, from [Failure alerts by Telegram](19-failure-alerts-by-telegram.md), the collector also has to cover:
  - Sending its own alerts to Telegram for Goodreads, the Letterboxd following list and the daily LLM run, with the thresholds, reminders and recovery messages decided there.
  - Writing a heartbeat to Redis on every run, and alerting when the Vercel refresh's last-success time is more than 1 hour old.
  - Warning 14 and 3 days before the Claude Code token expires.
  - Keeping the bot token and chat id in its env file, the last-sent time in memory for when Redis is unreachable, and a command that sends a test alert.
