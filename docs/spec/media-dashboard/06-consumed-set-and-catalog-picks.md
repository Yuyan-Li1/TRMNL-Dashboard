# Stage 6: Consumed set and Catalog picks

Read [the overview](README.md) first. This stage builds the full record of what the owner has Consumed and uses it to ship the Recommendation Mode with Catalog picks for games, movies and shows. Books get Recommendations in stage 8.

## Order of first runs

1. Vercel's daily run writes each source's full history to Redis.
2. The owner copies the exports to the home server and runs `collector seed` once.
3. The Collector's next tick merges and publishes one consumed set per medium under `home:`.
4. Only then does Vercel make Catalog picks: **with no published consumed set, Vercel makes none.**

## Slices

### 1. Full histories from Vercel

A daily run, separate from the 15-minute refresh and triggered by its own GitHub Actions schedule, writes each source's full history to Vercel-owned Redis keys:

- **Steam**: the whole library with play time. Every game in it counts as owned.
- **Xbox**: the whole `player/titleHistory` response (one unpaged call, about 106 titles, including PC Game Pass play and `Win32`-only entries).
- **PSN**: `getUserPlayedGames` paged to the end (about 375 entries), filtered to games, in union with the trophy list `getUserTitles` paged to the end. About 25 trophy titles have no counterpart in the played list, mostly games inside collections.
- **Switch**: the whole play history.
- **Trakt**: every watched show.
- **Letterboxd**: the owner's feed.

The 15-minute refresh keeps fetching recent activity only.

### 2. The consumed set

The Collector is its single owner.

- **`collector seed`** (one-off, safe to run twice) loads into SQLite from `~/trmnl-collector/exports/`:
  - the Letterboxd export taken on 2026-11-17 (544 films) with `letterboxd-tmdb-map.json`, which maps every film to a TMDB id;
  - the Goodreads export (260 read books), each with its Goodreads `Book Id`.
  - The files are in `~/trmnl-media-exports/` on the owner's Mac. Titles logged since the exports come from the live sources.
- **Each tick** the Collector reads Vercel's full-history keys, merges them into SQLite with the exports and the "also consumed" files, and publishes one consumed set per medium under `home:`. A newly Consumed title can take up to 15 minutes to reach the set; this is accepted.
- **What counts as Consumed**:
  - A game with 30 minutes or more of play, or with any trophy or achievement. An entry with no play time recorded (Xbox `Win32` entries, trophy-only PSN titles) counts.
  - A game in the Steam library is excluded from Recommendations even if unplayed. Ownership is known for Steam only.
  - Every film in the export or the diary, every watched show, every read book. A did-not-finish book does not count.
- **Matching**: by Catalog id. Games by IGDB id (the Collector looks names up in IGDB and stores the id, so its `.env` gains the Twitch credentials); movies and shows by TMDB id, which the sources supply; books by Goodreads id, falling back to title and author, because the id is per edition.
- **"Also consumed" files**: `~/trmnl-collector/also-consumed/<medium>.txt`, one title per line, optionally followed by a year or an author. They start empty. The Collector looks each new line up once (IGDB for games, Trakt search for movies and shows, Goodreads for books) and stores the id. A line it cannot match raises one Alert naming the line and is retried only when the line is edited. Adding a title here is the only way to reject a pick. The owner edits the files over SSH.
- The snapshot now includes these files.

### 3. Catalog picks

Rebuilt once a day on Vercel, in the daily run.

- **Seeds**: titles Finished or In progress in the last 90 days, skipping any the owner rated below 3.5 stars. Unrated titles count as liked.
- **From**: TMDB `/recommendations` for movies and shows (not `/similar`), IGDB `similar_games` for games.
- **Choosing**: go round the seeds, newest first, taking each seed's best result that is not in the consumed set, not already in the Pool and not barred from returning, until the medium has 5.
- **The Pool** holds up to 5 Catalog picks per medium. Vercel owns the Pool's record for both origins: each pick's Catalog id, origin, reason, the date it entered and its count of Spotlight appearances.
- **A pick leaves the Pool** at the next refresh once the title appears in the owner's activity (matched by Catalog id), after 3 Spotlight appearances, or after 30 days. It may not return for 6 months.

### 4. Recommendation on the screen

- **A Recommendation in the Spotlight**: Mode label "Recommendation" with the Medium; title; byline as for that medium; the public rating as stars with the Catalog's name; the reason, "Because you watched X" or "Because you played X"; then the Catalog description cut to about 140 characters. No "AI" label, now or in stage 8.
- The Mode takes its 20% share once any pick exists.

## Device check

- A Recommendation reads well on the panel, and a title the owner has Consumed never appears as one.
