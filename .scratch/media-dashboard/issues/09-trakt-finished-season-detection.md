# Trakt finished-season detection

Type: research
Status: resolved

## Question

Using only a Trakt client id and a public profile (no OAuth), how can the dashboard tell, for a show the owner is watching:

- the latest episode the owner watched;
- whether every aired episode of the current season, and of the whole show, has been watched;
- whether the show is still airing, ended or cancelled, and when the next episode airs.

Cover which endpoints provide this (watched shows, history, show and season summaries, `extended=progress` added in July 2026), the known bugs in them, how many requests one refresh would cost, and whether TMDB could supply the aired-episode side instead.

## Answer

Full findings: `docs/research/trakt-finished-season-detection.md` on branch `research/trakt-finished-season-detection` (pushed, never merged). Nothing was tested live, because no client id was available; every claim there is labelled by how it was established.

Detection is possible with a client id only:

- **Latest episode watched**: `/users/{slug}/history/episodes` gives season, number, title and `watched_at` (minute precision).
- **Watched episodes**: `/users/{slug}/watched/shows?extended=full,progress` gives per-season episode numbers, plays and `show.status`. Developers report the combined value works; Trakt staff have not confirmed it.
- **Aired episodes**: `/shows/{id}/seasons?extended=full` gives `aired_episodes` and `episode_count` per season, including season 0.
- **Status**: `status` is `returning series`, `continuing`, `ended`, `canceled` and others; an `ending` field is `concluded` or `open`.
- **Next episode**: `/shows/{id}/next_episode?extended=full` gives `first_aired`, or 204 when nothing is scheduled.
- **Not usable**: `/shows/{id}/progress/watched` has no user parameter and needs OAuth.

Rules that follow:

- Compare watched and aired counts per season, over seasons above 0, so specials never block Finished.
- Aired counts can lag after an episode airs, so a just-aired episode may briefly look unaired.
- Cost for 5 shows is 12 requests per refresh, or about 2 with show metadata cached, against 500 per 5 minutes.
- TMDB can supply status and next and last episode but has no documented aired count; keep it as a fallback.

Open risk, now its own ticket: [Trakt client id live check](17-trakt-client-id-live-check.md).
