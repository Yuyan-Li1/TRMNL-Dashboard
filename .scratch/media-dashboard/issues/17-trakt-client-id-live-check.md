# Trakt client id live check

Type: task
Status: resolved

## Question

Does a Trakt API app's client id read the owner's public profile without OAuth, and do the endpoints behave as documented?

Human in the loop: the owner creates a Trakt API app and provides its client id.

Check live and record:

- That `/users/{slug}/history/episodes` and `/users/{slug}/watched/shows?extended=full,progress` return the owner's data with the client id alone.
- That `/shows/{id}/seasons?extended=full` and `/shows/{id}/next_episode?extended=full` return aired counts, status and next air date.
- For one show the owner has finished and one they are partway through, that comparing watched and aired counts per season gives the right answer.
- Whether shows synced from the Sequel app appear promptly.

## Comments

- 2026-11-17, from [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md): also check that `/search/movie,show?query=...` works with the client id alone and returns a TMDB id for each result. LLM-named movies and shows are confirmed this way; if it fails they get Catalog picks only.

## Answer

Checked live on 2026-11-17 against the owner's public profile (`yuyan1111`) with a client id alone, no OAuth. Everything the ticket asked about works, with one item not measured.

What was done:

- The owner created a Trakt API app. Its client id is not stored in the repo: `.env.local` is blocked to agents by a deny rule, so the owner adds `TRAKT_CLIENT_ID` and `TRAKT_USER_SLUG=yuyan1111` there and in Vercel.
- Requests sent the headers `trakt-api-version: 2` and `trakt-api-key`.

Results:

- **History**: `/users/yuyan1111/history/episodes` returns 200 with show, season, number, title and `watched_at`; 3,139 items in all, paged.
- **Watched shows**: `/users/yuyan1111/watched/shows?extended=full,progress` returns 200 with 90 shows, per-season watched episode numbers, and the full show object including `status` and a whole-show `aired_episodes`. The combined value works. Without `progress` there is no `seasons` array.
- **Size and speed**: that response is 333 KB and took 1.2 s; every other call took 0.3 to 0.7 s.
- **Seasons**: `/shows/{slug}/seasons?extended=full` returns `episode_count` and `aired_episodes` per season, with specials as season 0.
- **Next episode**: `/shows/{slug}/next_episode?extended=full` returns 204 for both test shows, as documented when nothing is scheduled. `/shows/{slug}/last_episode` returns the last aired episode and its date.
- **Search**: `/search/movie,show?query=...` returns 200 and every result carries a TMDB id. Same-named titles tie on score ("Severance" returned a 2006 movie ahead of the 2022 show), so a pick must be matched on type and year, not taken as the first result.

The comparison gives the right answer for both test shows:

| Show           | Status           | Watched per season | Aired per season | Result                                            |
| -------------- | ---------------- | ------------------ | ---------------- | ------------------------------------------------- |
| Ted Lasso      | returning series | 10, 12, 12, 10     | 10, 12, 12, 10   | Finished: season 4 fully watched, no next episode |
| Nathan for You | ended            | 7 (season 1 only)  | 8, 8, 8, 7       | Not finished: season 1 is 7 of 8                  |

Differences from [Trakt finished-season detection](09-trakt-finished-season-detection.md):

- The `ending` field was `null` for both shows, including the ended one. Do not rely on it; use `status` and `next_episode`.
- No `X-Ratelimit` header came back on these GET requests, so the 500 per 5 minutes figure could not be confirmed.
- The user endpoints answer with `cache-control: public, max-age=600, s-maxage=3600`, so a new watch may take up to an hour to appear whatever the tracking app does.
- `watched_at` is not a reliable time of day. The owner's history shows runs of episodes spaced one runtime apart and several shows sharing one minute, which is what bulk-marking produces. Treat it as accurate to the day.

Not measured: how soon a watch marked in the Sequel app appears. No fresh Sequel entry was available to time; the newest history item was three days old. The one-hour cache above is the known lower bound on delay.
