# Stage 3: Shows

Read [the overview](README.md) first. This stage adds shows from Trakt. The owner's Trakt data is synced from the Sequel app. Everything below was checked live against the owner's public profile with a client id alone, no OAuth.

## Slices

### 1. Trakt client

- Send `trakt-api-version: 2` and `trakt-api-key: <TRAKT_CLIENT_ID>` on every request.
- `/users/<slug>/history/episodes`: the latest watched episodes, with show, season, number, title and `watched_at`. Only the first page is needed.
- `/users/<slug>/watched/shows?extended=full,progress`: every watched show with per-season watched episode numbers and the show's `status`. It is 333 KB and takes about 1.2 s; without `progress` there is no `seasons` array. Trakt caches user endpoints for up to an hour, so fetch this at most hourly.
- `/shows/<id>/seasons?extended=full`: `episode_count` and `aired_episodes` per season, specials as season 0. Cache it per show and refetch daily while the show is In progress.
- `/shows/<id>/next_episode?extended=full`: the next air date, or 204 when nothing is scheduled.
- Do not use the `ending` field (it was `null` even for an ended show) or `/shows/<id>/progress/watched` (needs OAuth).
- Artwork, public rating and overview come from TMDB by the TMDB id Trakt returns for the show.

### 2. Show rules

- Watching several episodes produces one entry for the show, never one per episode.
- Only seasons above 0 count, so specials never block Finished.
- **A season has ended** when its `aired_episodes` equals its `episode_count` and no next episode is scheduled in that season.
- **Finished**: the latest season the owner has watched has ended and the owner has watched every episode of it. The finish date is the `watched_at` of its last episode. Eligible for 14 days.
- **Caught up**: every aired episode of the season is watched while the season is still running. This is In progress, labelled "caught up".
- **In progress**: an episode watched in the last 14 days, and not Finished.
- `watched_at` is accurate only to the day (bulk-marking produces false times). Show days, never hours.
- Aired counts can lag just after an episode airs. This is accepted.
- Shows carry no owner's rating.

### 3. Shows on the screen

- **A show in the Spotlight**: Mode label with "Show"; title; byline is the season ("Season 2"); no rating; facts are the latest episode watched ("S2 E5") and when, with "caught up" where it applies, or "Season finished" for Finished; a progress bar of watched against aired episodes in the season when In progress; then the TMDB overview.
- **The shows Medium card**: thumbnail, title, episode and "caught up", and when.

## Known limit

- A watch marked in Sequel may take an hour or more to appear. The delay was not measured.

## Device check

- An In progress show and a Finished show read well on the panel.
