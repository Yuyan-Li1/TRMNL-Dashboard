# Trakt: detecting latest watched episode, finished seasons and airing status (client id only)

Research ticket, 2026-11-17. Throwaway branch `research/trakt-finished-season-detection`; not for merge.

**Question.** With only a Trakt client id (`trakt-api-key` header) and a public profile, how can the dashboard tell, for each show the person is watching: the latest episode watched; whether every aired episode of the current season and of the whole show is watched; whether the show is airing, ended or cancelled; and when the next episode airs?

## Evidence labels

| Label | Meaning |
| --- | --- |
| **[DOC]** | Stated in Trakt's OpenAPI spec, the developer guides, or the API contract source in `trakt/trakt-api`. |
| **[STAFF]** | Stated by Trakt staff (`kevincador`, `rectifyer`, `vladjerca`) in a `trakt/trakt-api` issue or discussion. |
| **[3P]** | Reported by a third-party developer in an issue or discussion, usually with a pasted payload. Not reproduced here. |
| **[FETCH]** | I fetched it myself on 2026-11-17. |
| **[UNCONFIRMED]** | Inferred, or not testable without a client id. |

**Nothing against `api.trakt.tv` was tested.** I have no client id. A request without one returns HTTP 403 with a Cloudflare "Attention Required" page [FETCH], so every statement about live response bodies below is [DOC], [STAFF] or [3P], never [FETCH]. What I did fetch: the OpenAPI spec, the guides and contract source in the repo, the issues and discussions, and two TMDB doc pages.

## Answer in short

It is doable with a client id, in about 12 requests per refresh for 5 shows, or 2 per refresh if show metadata is cached in Redis.

| Need | Endpoint | Fields |
| --- | --- | --- |
| Which shows are current, and the latest episode with its title | `GET /users/{slug}/history/episodes?limit=N` | `watched_at`, `episode.season`, `episode.number`, `episode.title`, `show.ids` |
| Which episodes are watched, per season | `GET /users/{slug}/watched/shows?extended=full,progress&limit=N` | `seasons[].number`, `seasons[].episodes[].number`, `.plays`, `.last_watched_at`, `reset_at` |
| Aired episodes per season | `GET /shows/{id}/seasons?extended=full` | per season `number`, `aired_episodes`, `episode_count` |
| Airing, ended or cancelled | `show.status` embedded in the watched response, or `GET /shows/{id}?extended=full` | `status`, `ending`, `last_aired`, `airs` |
| Next episode date | `GET /shows/{id}/next_episode?extended=full` | `season`, `number`, `title`, `first_aired`; `204` when none |

`/shows/{id}/progress/watched` would answer the season question in one call, but it cannot be used: see "The OAuth-only progress endpoint".

The three things most likely to break this in practice, none of which I could test:

1. Whether a client id from a Development app is accepted for key-only reads of a public profile.
2. Whether `show.aired_episodes` counts specials. The design below avoids depending on it.
3. Whether `extended=full,progress` stays supported. Staff have not confirmed it.

## Endpoints and exact fields

### 1. History: `GET /users/{id}/history/episodes`

- Labelled "OAuth Optional, Pagination, Extended Info" [DOC, spec]. Variants: `/history/`, `/history/shows`, `/history/episodes`, `/history/shows/{item_id}`, `/history/episodes/{item_id}` [DOC, spec].
- Query: `page`, `limit`, `start_at`, `end_at`, `extended` [DOC, spec]. The spec says an omitted limit gives "a low default limit (often 10)" and a provided one is "capped at the endpoint maximum (often 250)" [DOC, spec].
- Item shape [DOC, spec]:
  - `id` (int64 history id), `watched_at`, `action` (`scrobble` | `checkin` | `watch`), `type` (`episode`)
  - `episode`: `season`, `number`, `title` (nullable), `ids.{trakt,tvdb,imdb,tmdb}`; with `extended=full` also `first_aired`, `runtime`, `episode_type` (`standard`, `series_premiere`, `season_premiere`, `mid_season_finale`, `mid_season_premiere`, `season_finale`, `series_finale`), `overview`
  - `show`: `title`, `year`, `ids.{trakt,slug,tvdb,imdb,tmdb}`; with `extended=full` the full show object including `status` and `aired_episodes`
- `watched_at` has minute precision only. Seconds and milliseconds are zeroed on all stored and new timestamps, rollout complete 1 March 2026 [STAFF, discussion 694]. `rectifyer`, 2026-08-03: "We don't have second and millisecond precision, only to the minute" [STAFF, issue 876]. Two episodes marked in the same minute tie, so break ties by highest season then episode number.
- Sort order (newest first) is long-standing behaviour but is not stated in the current spec text [UNCONFIRMED].
- This is the only source of the episode **title** for the latest watch. The watched endpoint returns numbers only.

### 2. Watched shows: `GET /users/{id}/watched/shows`

Labelled "OAuth Optional"; "Returns all movies or shows a user has watched sorted by most recently watched" [DOC, spec, `/users/{id}/watched/{type}`].

Behaviour since the July 2026 change (live 2026-07-03) [STAFF, discussion 775]:

- No pagination params: page 1, up to 100 items. General maximum 250.
- `extended=progress` is capped at 100 items per page.
- Season data is no longer returned by default; request `extended=progress`.
- `extended=min` returns a compact map of Trakt id to watched dates, unpaginated.
- `noseasons` is a no-op.
- Read `X-Pagination-Page`, `X-Pagination-Limit`, `X-Pagination-Page-Count`, `X-Pagination-Item-Count`; do not assume the requested limit was applied.

Response shape per `extended` value. Staff announced "full item information by default", but two developers measured otherwise after rollout:

| `extended` | `show` object | `seasons` |
| --- | --- | --- |
| none | `title`, `year`, `ids`, `aired_episodes` | absent |
| `full` | complete (`status`, `network`, `airs`, `genres`, `first_aired`, `updated_at`, ...) | absent |
| `progress` | `title`, `year`, `ids`, `aired_episodes` | present |
| `full,progress` | complete | present |

Source: `jonathanantoine`, tested 2026-07-27 on both `/sync/watched/shows` and `/users/{id}/watched/shows` with identical results; `betablon`, 175-show account, 2026-07-20 [3P, discussion 775 and issue 875]. No staff reply to the 2026-07-27 question about whether `full,progress` can be relied on was present when I read the thread [FETCH]. `progress` is not listed in the Extended Info guide [DOC, `extended-info.md`].

Fields [DOC, contract `watchedShowsResponseSchema.ts`; payloads in issues 835 and 837]:

- Wrapper: `plays` (sum of all episode plays, so it exceeds the episode count after rewatches [3P, issue 421]), `last_watched_at`, `last_updated_at`, `reset_at` (nullable)
- `show.aired_episodes` (integer, present in every variant), `show.title`, `show.year`, `show.ids`
- `seasons[]`: `number`, `episodes[]`: `number`, `plays`, `last_watched_at`. No episode title and no episode ids [3P, discussion 775; DOC, contract].
- Query flags `specials`, `count_specials`, `hidden` [DOC, spec].

Even with `full`, the embedded show has empty `overview` and `tagline`, on purpose: "we're no longer treating this route as the source for full show metadata ... hydrate metadata separately from `/shows/{id}?extended=full`" [STAFF, issue 837]. The guide says embedded objects are "a convenience snapshot ... not the freshest metadata record" [DOC, `caching-and-fresh-data.md`]. So `status` read from here can lag the summary endpoint.

The spec itself is out of step with the above [FETCH of spec]: `/users/{id}/watched/shows` is documented only as the minimal variant with `extended` required and limited to `min` (plus `specials` and `season_numbers`); the typed route `/users/{id}/watched/{type}` documents no `page` or `limit`; and neither mentions `progress`. Treat discussion 775 as the authority.

### 3. Show summary: `GET /shows/{id}?extended=full`

No OAuth label. `{id}` is a Trakt id or slug [DOC, spec].

- `status` values, from the spec note: `returning series` (airing right now), `continuing` (airing right now), `in production` (airing soon), `planned` (in development), `upcoming` (in development), `pilot`, `canceled`, `ended` [DOC, spec]. The contract enum also allows `released`, `post production`, `rumored`, which are movie values [DOC, `statusResponseSchema.ts`]. Note the spelling `canceled`.
- `ending`: `concluded` (finished on purpose) or `open` (cut off); null when unknown or still airing [DOC, `showResponseSchema.ts`].
- `aired_episodes` (integer), `first_aired`, `last_aired` ("air date of the most recently aired episode; null until the show has aired an episode"), `airs.{day,time,timezone}` (relative to the show's country), `network`, `updated_at` [DOC, spec and contract].
- `aired_episodes` is computed as episodes with `first_aired <= now` [STAFF, issue 217, 2022].
- Whether show-level `aired_episodes` includes season 0 is not stated anywhere I found [UNCONFIRMED].
- Shows can "un-end" (revivals), so do not cache `ended` forever [3P, issue 187].

### 4. Seasons: `GET /shows/{id}/seasons?extended=full`

"Returns all seasons for a show including the number of episodes in each season" [DOC, spec].

- Per season: `number`, `ids`, `title`, `aired_episodes`, `episode_count`, `first_aired`, `updated_at`, `network` [DOC, spec]. `aired_episodes` and `episode_count` are documented as available only with `extended=full` [DOC, `seasonResponseSchema.ts`].
- Season 0 is returned, titled "Specials", with its own counts. Example: `"number": 0, "episode_count": 73, "aired_episodes": 73` [3P, payload in issue 799].
- `extended=full,episodes` adds an `episodes` array per season; it was broken (empty arrays) and fixed 2026-05-31 [STAFF, issue 799]. The spec warns it "returns a lot of data".
- Related: `GET /shows/{id}/seasons/{season}/info` (one season, same fields) and `GET /shows/{id}/seasons/{season}` (all episodes of a season, each with `first_aired` under `extended=full`) [DOC, spec].

### 5. Next and last episode

- `GET /shows/{id}/next_episode`: "Returns the next scheduled episode for a show. If no episode is found, a 204 response is returned." [DOC, spec]
- `GET /shows/{id}/last_episode`: "Returns the most recently aired episode for a show. If no episode is found, a 204 response is returned." [DOC, spec]
- Both return a standard episode: `season`, `number`, `title`, `ids`; with `extended=full` also `first_aired` (UTC datetime), `runtime`, `episode_type`, `overview` [DOC, spec]. Request `extended=full`, otherwise there is no air date.
- 204 is deliberate, and `last_episode` is driven by `first_aired`; a show whose only episode has a null `first_aired` returns 204 [STAFF, issue 422].
- A 2023 response for `last_episode` carried `cache-control: public, max-age=28800` and a Cloudflare cache hit [3P, issue 422], and show data was said to expire after 8 hours [3P, issue 217]. Current cache lifetimes are [UNCONFIRMED].
- Whether `next_episode` can return a special is [UNCONFIRMED].

### 6. The OAuth-only progress endpoint

`GET /shows/{id}/progress/watched` returns `aired`, `completed`, `last_watched_at`, `reset_at`, `next_episode`, `last_episode`, and `seasons[].{number,title,aired,completed,episodes[].{number,completed,last_watched_at}}` [DOC, spec]. That is exactly the wanted answer, but:

- It is labelled "OAuth Required" [DOC, spec and contract].
- It has no user parameter, so it can only describe the token's owner [DOC, spec].
- Its `security` block lists a key-only alternative, but that block carries no information: 84 operations labelled "OAuth Required" list the same key-only alternative [FETCH of spec, counted].

Conclusion: not usable without OAuth. Whether a key-only call returns 401 or something else is [UNCONFIRMED].

## How to compute each answer

1. **Current shows and latest episode.** Read the newest N history entries; group by `show.ids.trakt`; the first entry per show is the latest watch, giving season, number, title and `watched_at`.
2. **Current season.** The season of the latest watched non-special episode.
3. **Season finished.** `watched(S)` = episodes in `seasons[number == S]` with `plays >= 1`, ignoring any whose `last_watched_at` is before `reset_at` when `reset_at` is set. Finished when `watched(S) >= aired_episodes` of season S from the seasons endpoint.
4. **Show finished.** Sum both sides over seasons with `number > 0`. Using per-season sums rather than `show.aired_episodes` sidesteps the unknown about specials.
5. **Status.** `returning series` or `continuing` means airing; `ended` and `canceled` are terminal; `in production`, `planned`, `upcoming`, `pilot` mean nothing airing yet.
6. **Next episode.** `next_episode` 200 gives `first_aired`; 204 means nothing scheduled. "Caught up, more coming" is season finished plus either a next episode or `episode_count > aired_episodes` for that season.

## Specials (season 0)

- Progress-type responses exclude specials by default. `specials=true` adds season 0, and `count_specials=false` keeps them out of totals [DOC, spec for `/shows/{id}/progress/watched`].
- The same applies to `watched/shows?extended=progress`: "You should use `specials=true` if you want specials to be included with progress-type responses" [STAFF, issue 792]. The flag is not mentioned in discussion 775 [3P, same issue].
- A 2024 report says `count_specials=false` still included 41 specials in `aired` on the progress endpoint; it has no reply [3P, discussion 466].
- History does include watched specials as `season: 0` entries [UNCONFIRMED, inferred from the episode object].
- The seasons endpoint always lists season 0.

Recommendation: leave `specials` unset, drop `number == 0` on both sides, and ignore `season: 0` history entries when choosing the current season.

## Known bugs and quirks

| Item | Status | Source |
| --- | --- | --- |
| `reset_at` always null with `extended=progress` | Reported 2026-05-23; fix promised 2026-05-26; no confirmation in thread | [3P]+[STAFF] discussion 775 |
| 500 `handler.users.getUserWatchedShows` on the progress variant | Reported 2026-05-30; no reply | [3P] discussion 775 |
| Out-of-range page returns duplicate data, not `[]` | Reported 2026-06-04; no reply. Stop on the page-count header | [3P] discussion 775 |
| Default response is minimal, not "full" as announced | Observed 2026-07-27; unanswered | [3P] discussion 775 |
| Shows whose seasons are all hidden went missing | Fixed 2026-05-27. Hidden seasons are excluded unless `hidden=true` | [STAFF] issue 795 |
| `last_updated_at` differed between `full` and `progress` | Fixed about 2026-07-27 | [STAFF] issue 876 |
| `overview` and `tagline` empty in watched responses | By design | [STAFF] issue 837 |
| `aired` count lagging behind a newly aired episode on the progress endpoint | Caching side effect, not fixed (2020) | [STAFF] issue 162 |
| Watched and progress disagreeing on an episode | Attributed to caching, reworked 2020 | [STAFF] issue 138 |
| `reset_at` wrong on `/shows/{id}/progress/watched` | Fixed 2026-02-25 | [STAFF] issue 661 |
| Calendar endpoint silently omitting scheduled episodes | Acknowledged, low priority (August 2026) | [STAFF] issue 911 |

The lag in aired counts is the main correctness risk: for some hours after an episode airs, a season may still read as finished. `next_episode` flipping to the following episode is an independent signal [3P, issue 162].

## Request cost for about 5 current shows

Limit: 500 GETs per 5 minutes for unauthenticated calls, bucketed by client id plus public IP (`UNAUTHED_API_GET_LIMIT`) [DOC, `rate-limiting.md`]. Vercel functions have changing egress IPs, so the bucket may vary [UNCONFIRMED].

| Plan | Requests per refresh | Per day (96 refreshes) |
| --- | --- | --- |
| Everything every time: history 1 + watched 1 + seasons 5 + next_episode 5 | 12 | 1,152 |
| Same plus canonical show summary per show | 17 | 1,632 |
| History and watched every time; seasons, status and next episode cached in Redis, refetched every 6 hours or when a new watch appears | 2 typical, 12 on a refetch | about 230 |

Notes:

- `limit` on the watched call can be small because the list is sorted by most recently watched [DOC, spec]. Whether small limits behave correctly with `extended=progress` is [UNCONFIRMED].
- One call to `/shows/{id}/seasons?extended=full,episodes` might replace the seasons and next-episode calls, if its episodes carry `first_aired` [UNCONFIRMED].
- The watched call could be dropped by reading `/users/{slug}/history/shows/{id}` per show, but that paginates for long shows and costs more.
- Staff guidance is to cache show metadata separately from user state [STAFF, issue 421; DOC, `caching-and-fresh-data.md`].

## Could TMDB supply the aired side?

Partly, and it is not needed.

- `GET /3/tv/{series_id}` documents `status` (example `"Ended"`), `in_production`, `number_of_episodes`, `number_of_seasons`, `first_air_date`, `last_air_date`, `last_episode_to_air.{season_number,episode_number,name,air_date}`, `next_episode_to_air` (untyped, example `null`), and `seasons[].{season_number,episode_count,air_date,name}`. The page gives no field descriptions. Auth is a bearer token in `Authorization` [FETCH, developer.themoviedb.org/reference/tv-series-details].
- Rate limit: the old 40 per 10 seconds limit was disabled on 2019-12-16; current limits "sit somewhere in the 40 requests per second range" [FETCH, developer.themoviedb.org/docs/rate-limiting].
- Trakt show objects carry `ids.tmdb` (nullable), so the join key exists [DOC, spec].
- TMDB has no documented aired-episode count. Whether `number_of_episodes` and `episode_count` count unaired episodes or specials is [UNCONFIRMED]. Aired-in-season would have to come from `last_episode_to_air.episode_number`, or from fetching the season and counting `air_date <= today`.
- TMDB `air_date` is a date without a time; Trakt `first_aired` is a UTC datetime.
- Whether Trakt and TMDB number seasons and episodes identically for every show is [UNCONFIRMED].

One TMDB call per show would cover status, next episode and last aired episode, but it adds a second key, a second attribution requirement and a numbering-mismatch risk, while Trakt's own public endpoints already give per-season aired counts. Keep TMDB as a fallback only.

## Access prerequisites and policy

- Required headers: `trakt-api-key`, `trakt-api-version: 2`, `Content-Type: application/json`, and a `User-Agent` [DOC, `required-headers.md`].
- Creating an app requires a verified GitHub account; VIP is not required [DOC, `create-an-app.md`, `api-use-policy.md`]. From 1 January 2027 apps without a linked GitHub account become unapproved [STAFF, discussion 1031].
- New apps are Development apps; "apps for yourself or a few people stay on Development" [DOC, `create-an-app.md`]. Whether a Development client id works for key-only reads of another public profile is [UNCONFIRMED].
- "A personal tool in regular use counts as an active app"; caching and background updates are allowed; an attribution line ("uses Trakt but is not endorsed or certified by Trakt") is required on an About or credits page [DOC, `api-use-policy.md`].
- The profile must be public. Behaviour for a private profile with key only is [UNCONFIRMED]; the API exposes an `X-Private-User` header.

## What to test once a client id exists

1. `GET /users/{slug}/watched/shows?extended=full,progress&limit=10`: status code, `seasons` present, `show.status` present, pagination headers, sort order.
2. Whether `show.aired_episodes` equals the sum of season `aired_episodes` with or without season 0, on a show that has specials.
3. `GET /shows/{id}/next_episode?extended=full` on an ended show (expect 204) and an airing one.
4. `reset_at` on a show that has been reset.
5. `GET /shows/{id}/progress/watched` with key only, to record the failure mode.
6. The `X-Ratelimit` header when called from Vercel.

## Sources

Trakt, first-party:

- OpenAPI spec, version 2.0.0, 318 paths, fetched 2026-11-17: https://developer.trakt.tv/openapi.json
- Guides in `trakt/trakt-api` under `projects/developer/src/lib/guides/`: `extended-info.md`, `rate-limiting.md`, `caching-and-fresh-data.md`, `required-headers.md`, `pagination.md`, `create-an-app.md`, `api-use-policy.md`, `standard-media-objects.md`
- Contract source in `trakt/trakt-api` under `projects/api/src/contracts/`: `shows/index.ts`, `shows/schema/response/seasonResponseSchema.ts`, `shows/schema/response/showProgressResponseSchema.ts`, `shows/schema/request/showQueryParamsSchema.ts`, `users/subroutes/watched.ts`, `users/subroutes/history.ts`, `users/schema/response/watchedShowsResponseSchema.ts`, `_internal/response/showResponseSchema.ts`, `_internal/response/statusResponseSchema.ts`, `_internal/response/showEndingResponseSchema.ts`
- Discussions: https://github.com/trakt/trakt-api/discussions/775 (watched pagination and `extended`), /694 (`watched_at` precision), /1031 (GitHub verification), /943 (API guidance), /466 (specials in progress)
- Issues in https://github.com/trakt/trakt-api/issues: 876, 875, 837, 835, 799, 795, 792, 911, 661, 422, 421, 217, 187, 162, 138

TMDB, first-party:

- https://developer.themoviedb.org/reference/tv-series-details
- https://developer.themoviedb.org/docs/rate-limiting
