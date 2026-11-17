# Stages and spec

Type: grilling
Blocked by: 04, 06, 08, 09, 11, 12, 13, 15, 17, 18, 19, 20, 21
Assignee: Yuyan Li
Status: resolved

## Question

In what stages is the rebuild delivered, and what does each stage ship?

Assemble the decisions from every closed ticket into the staged spec named in the map's Destination. Settle the order, for example: remove the schedule system and MongoDB; the new screen with games and movies; shows; books through the home collector; friends; recommendations; Switch. Each stage must leave a working device.

## Answer

Resolved 2026-11-17 by grilling with the owner. The spec is written in `docs/spec/media-dashboard/`: an overview (`README.md`) and one file per stage. It is committed on the stack branch `media-dashboard-spec`.

### Stages

1. **New screen with games**: removes the old dashboard and MongoDB; the chosen layout, fonts and poster recipe; IGDB; Steam, Xbox, PSN and Switch. Spotlight is In progress only.
2. **Movies**: the owner's Letterboxd feed and TMDB; adds the Finished mode.
3. **Shows**: Trakt, with finished-season detection and Caught up.
4. **Alerts and status strip**: Telegram from Vercel, the status strip, the source health page; deletes the two GitHub issue workflows.
5. **Collector and books**: home server setup, `collector tick`, SQLite, snapshot, code update, the Goodreads read.
6. **Consumed set and Catalog picks**: full histories to Redis, `collector seed`, the published consumed set, the Recommendation mode.
7. **Friend activity**: the Letterboxd following list and friends' diary feeds.
8. **LLM picks**: run folders, the hook, change detection, confirmation; book Recommendations.

Stages 6 and 7 were swapped from the first proposal, because the spoiler rule needs the full consumed set.

### Decisions made here

- **Form**: one overview plus one file per stage; each stage is one stack whose slices are its branches, and may take more than one session.
- **Done**: CI passes, deployed to production, checked by the owner on the device. Poster tuning at full size and on thumbnails, the self-hosted fonts through the Screenshot plugin, and the source health page's layout (a plain table) are settled at those checks.
- **Removal** of the old dashboard is the first slice of stage 1, not a stage of its own.
- **Reachability**: Nintendo (stage 1) and Letterboxd (stage 2) are tried with one request from a Vercel preview first. A source that fails moves to the Collector and ships with stage 5; the order does not change.
- **Between stages 1 and 4** the two GitHub issue workflows stay in a cut-down form: `/api/health` checks Redis only and `/api/tokens` reports only the live PSN check. Both read MongoDB today.
- **Nothing to show**: a Medium card shows the latest activity however old, or the Medium's name with "Nothing yet". With nothing eligible in any Mode, the Spotlight is the most recently active title with artwork, in its own Mode.
- **Home server unreachable for long**: nothing special on the screen; Alerts and the status strip are the signal.
- **Refresh trigger**: GitHub Actions stays; the Collector's tick also calls the refresh when the last success is over 30 minutes old.
- **Home server setup**: one guided checklist at the start of stage 5, including the Claude Code CLI and `claude setup-token`, so that Claude Code on the Intel Mac is proven before stage 8.
- **Friends' diary feeds** are read by the Collector in the same 6-hourly job as the following list.
- **First runs**: `collector seed` runs once in stage 6; Vercel makes no Catalog picks until a consumed set is published; the Collector makes no LLM run until the seed has been run.
- **Full histories** are written by Vercel once a day in a separate run; the 15-minute refresh fetches recent activity only.
- **Owned games** means the Steam library only.
- **Attribution** for TMDB and IGDB goes on the status strip, never on the panel.
- **Where the spec ends**: stage 8. The Goodreads session, Steam friends' reviews, current watchlists, easier taste-model editing and movie and show taste models are recorded as later efforts.

### Defaults the spec takes, chosen while writing and not put to the owner

- Dithered posters are stored in Redis and embedded in the page as data URIs.
- Freshness weight within a Mode is `1 / (1 + days since activity)`.
- A Finished title shows the owner's review if there is one, otherwise the Catalog description.
- Shows carry no owner's rating.
- Catalog picks are chosen by going round the seeds, newest first.
- Vercel keeps the Pool's record (appearances, retirements) for both origins; the Collector reads it.
- Environment variable names.

## Comments

- 2026-11-17, from [Home collector design](13-home-collector-design.md), the stages also have to place:
  - The home server setup the owner must do by hand (Node, the Claude Code CLI, `claude setup-token`, the `.env` file, the launchd job), and a first check that Claude Code runs on the Intel Mac.
  - Vercel's refresh writing each source's full history to Redis, which the collector's consumed set depends on.
  - The order of `collector seed`, the first Goodreads run and the first LLM run.
