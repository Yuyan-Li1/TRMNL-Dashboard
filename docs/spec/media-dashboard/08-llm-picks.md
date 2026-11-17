# Stage 8: LLM picks

Read [the overview](README.md) first. This stage adds LLM picks to the Pool for all four media, made by the Claude Code CLI on the home server under the owner's Max subscription. Books get their first Recommendations here.

## Caveats the owner has accepted

- Anthropic's consumer terms bar automated access except where explicitly permitted; reading the CLI's documented script use as that permission is an interpretation.
- Usage counts against the normal Max limits. A trivial run reported a notional cost of about $1.
- The token from `claude setup-token` lasts one year (expiry Alerts are already in place from stage 5).
- Claude is never called from Vercel or through the Agent SDK.

## Guard

**The Collector makes no LLM run until `collector seed` has been run** (stage 6).

## Slices

### 1. Run folders

- One per medium on the home server, outside the repo: `~/trmnl-collector/llm-run/games/`, `books/`, `movies/`, `shows/`. Each holds:
  - `taste.md`, the owner's taste model, the only file the owner edits. Taste models exist for games and books; a medium without one runs on history alone.
  - a generated `CLAUDE.md` with the shared rules for a pick, importing `taste.md`.
  - `.claude/settings.json` with the hook.
- The repo holds only the templates for `CLAUDE.md`, the settings file and the hook script; the daily code update copies them into place. The repo is public, so taste models never enter git. The snapshot includes them.
- **Rules in the generated `CLAUDE.md`**:
  - The taste model is authoritative. Recent history shows what is current and what is Consumed; it never overrides a taste model rule. The taste model's own "played", "on hold" and data-reliability sections are exclusions.
  - A reason is at most 100 characters, written against the taste model, naming the fit and any warning, for example "Conceit-driven SF; slow first 100 pages, payoff is extraordinary".
  - Games must be on PC, PS5, PSVR2 or Switch 2. Books must be available in English unless originally Chinese. No price filter.
  - Web search may be used to check a pick against the taste model and to include recent releases.

### 2. The run

- **Daily at 04:00 Sydney** the Collector checks each medium and runs it only when something has changed: a title entered or left the history, a rating changed, `taste.md` or the "also consumed" file was edited, or fewer than 3 LLM picks remain for that medium. Play time and reading progress do not count as a change. The Collector fingerprints the prompt data, `taste.md` and the "also consumed" file, and keeps the log in SQLite; with nothing changed it exits before calling Claude.
- **The prompt** carries only the data that changes: the last 50 titles with the owner's ratings and play time, and every title recommended before. It never includes TMDB data. It asks for 10 picks so that 5 survive.
- **Invocation**: one `claude -p` per changed medium, one after another, run inside that medium's folder, with `--output-format json`, `--json-schema`, `--tools "WebSearch,WebFetch"`, `--allowedTools "WebSearch,WebFetch"` and `--permission-mode dontAsk`. Never `--bare`, which ignores the subscription token. Tool allowances go on the command line because permission rules in a project settings file are ignored in an untrusted folder. Claude has no file or shell access. No `ANTHROPIC_API_KEY` may be in the job's environment.
- **The 100-character reason**: a `PreToolUse` hook on the `StructuredOutput` tool rejects any reason over 100 characters, and Claude shortens it in the same run. (A `PostToolUse` hook was tested and does not work.) The Collector still drops any pick that arrives over length. The schema's `maxLength` is not relied on.

### 3. Confirmation and publishing

- **Confirm each pick in a Catalog**; a pick no Catalog recognises is dropped:
  - Movies and shows: Trakt search, `/search/movie,show?query=...`, which returns a TMDB id. Match on type and year, never the first result ("Severance" returns a 2006 movie ahead of the 2022 show). The Collector's `.env` gains `TRAKT_CLIENT_ID`.
  - Games: IGDB.
  - Books: Goodreads search. The Collector also fetches the cover, average rating and description, since only it reaches Goodreads.
- **Check each pick** against the consumed set in SQLite and against the Pool's record of titles barred from returning.
- **Publish** up to 5 confirmed picks per medium under `home:`, each with its Catalog id and reason. Vercel adds artwork, rating and description by id for games, movies and shows (so TMDB is called only from Vercel), counts Spotlight appearances and applies the same retirement rules as for Catalog picks. The Collector reads Vercel's Pool record to learn which titles were recommended before.
- **Failure**: existing LLM picks stay until a run succeeds, subject to the retirement rules; Catalog picks carry the Mode meanwhile. A failed daily run alerts after 1 failure.
- **If Goodreads' unofficial endpoints are retired**, books have no Recommendations and the Mode skips them.

### 4. On the screen

- The same Recommendation card as stage 6, with the LLM's reason in place of "Because you watched X". No "AI" label.
- The Pool now holds up to 5 Catalog picks and 5 LLM picks per medium (books: 5 LLM picks only).

## Check

- A run with an over-long reason comes back shortened by the hook.
- Editing `taste.md` causes a run the next morning; a day with no change causes none.
- A book Recommendation reads well on the panel.
