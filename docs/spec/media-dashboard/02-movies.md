# Stage 2: Movies

Read [the overview](README.md) first. This stage adds movies from the owner's Letterboxd diary and brings in TMDB as the Catalog for movies. The Spotlight gains the Finished Mode.

## Before building

**Reachability check**: from a Vercel preview, fetch the owner's public diary feed, `https://letterboxd.com/<LETTERBOXD_USERNAME>/rss/`, once. If Letterboxd does not answer from Vercel, movies are read by the Collector in stage 5 and the rest of this stage (TMDB, the Finished Mode, the screen) is built there with them.

## Slices

### 1. Letterboxd feed

- The feed holds 100 items mixing diary entries and lists. Keep diary entries only. Each carries the owner's rating, the watched date, a rewatch flag, a poster and a TMDB id. An entry with a review has a `letterboxd-review-N` guid and the full review text in its description.
- Trakt's movie history is ignored. Letterboxd's official API is not used.

### 2. TMDB

- By the TMDB id from the feed, fetch the poster, `vote_average`, `overview`, the release year and the director.
- TMDB-derived data in Redis, including its `:latest` copy, is refetched within 6 months.
- Show the TMDB attribution notice and logo on the page below the 800x480 area the device captures. Stage 4 builds the status strip around it.

### 3. Movies on the screen

- A movie is never In progress. It is Finished when logged in the diary, and eligible for the Spotlight for 14 days from its watched date.
- **A movie in the Spotlight**: Mode label "Finished" with "Movie"; title; byline is year and director; the owner's rating as stars followed by "You" (omitted if the entry has no rating); the fact is when it was watched, with "Rewatch" when flagged; then the owner's review if there is one, otherwise the TMDB overview.
- **The movies Medium card**: thumbnail, title, the owner's stars, "Watched", and when.
- Poster: the TMDB poster through the pipeline; the feed's own poster is the fallback.

## Device check

- A Finished movie in the Spotlight and the movies Medium card read well on the panel.
