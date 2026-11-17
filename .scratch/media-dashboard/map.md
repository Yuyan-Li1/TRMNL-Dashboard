# Map: Media dashboard

Label: wayfinder:map

## Destination

A staged spec for rebuilding the TRMNL dashboard as a media-only display (games, movies, shows, books), with every product and source decision made, so that each stage can be handed to an implementation session with nothing left to decide.

## Notes

- Domain language lives in `GLOSSARY.md` at the repo root. Use its terms (Medium, Source, Catalog, Title, Spotlight, Mode, Medium card) and update it as terms settle.
- Every grilling session calls the `grilling` and `domain-modeling` skills.
- Project constraints are in `CLAUDE.md`: 800x480, 2-bit grayscale, 15-minute device refresh, Vercel Hobby, free-tier services.
- The owner prefers free services, public profiles over logins, and has an always-on home server (also the Plex server and Time Machine host) available as a collector.
- The home server is reached with `ssh homeserver`.
- Planning only: tickets produce decisions, not code. Removal of the old schedule system is already decided and is implementation work for the spec's first stage.

## Decisions so far

- [Scope and screen shape](issues/01-scope-and-screen-shape.md): media only; one Spotlight with artwork plus a Medium card for each other medium; Spotlight re-picked every device refresh.
- [Sources and friends](issues/02-sources-and-friends.md): Letterboxd for movies, Trakt for shows, Goodreads for books, Steam/Xbox/PSN for games; TMDB and IGDB as Catalogs; friends are everyone followed on Letterboxd, plus Steam reviews later.
- [Home server, storage and LLM route](issues/03-home-server-storage-and-llm-route.md): Vercel renders, the home server collects hard sources into Redis, MongoDB is removed, LLM picks come from the Claude Code CLI on the home server.
- [Modes and Spotlight rotation rules](issues/04-modes-and-spotlight-rotation-rules.md): four modes including Friend activity; a show is Finished only when its season or run has ended; shares 35/25/20/20; 14-day eligibility.
- [Nintendo Play Activity test](issues/12-nintendo-play-activity-test.md): works for the owner's US-region account with Switch 2 titles, images and play minutes; session token valid to 2028-11-16.
- [Trakt finished-season detection](issues/09-trakt-finished-season-detection.md): possible with a client id by comparing watched and aired episodes per season; untested live.
- [TRMNL image rendering](issues/10-trmnl-image-rendering.md): TRMNL screenshots and converts the page; dither posters to four greys ourselves at refresh time and serve them as plain images.
- [Catalog capabilities](issues/07-catalog-capabilities.md): TMDB and IGDB can confirm a title and supply artwork, rating and description; book ratings and descriptions are thin; TMDB terms restrict AI-related use.
- [How Switch joins the game sources](issues/15-how-switch-joins-the-game-sources.md): fetched from Vercel with the other game sources; one Title per game across platforms; cleaned names; IGDB covers; ships in the same stage.
- [Goodreads no-login surface](issues/05-goodreads-no-login-surface.md): without a login Goodreads still gives covers, the owner's rating, reading progress and a newest-first read shelf, but no finish dates; untested from Vercel.
- [How catalog and LLM recommendations combine](issues/08-how-catalog-and-llm-recommendations-combine.md): one pool of 5 Catalog and 5 LLM picks per medium; LLM picks use owner-written taste models and are confirmed by Trakt, IGDB or Goodreads; every pick is checked against a full consumed set.
- [How Goodreads is read](issues/06-how-goodreads-is-read.md): the no-login route is the always-running baseline, read by the home server every 6 hours; finish date is the day a book is first seen as read; the logged-in session is a later layer for real dates and friends' books.
- [Confirm TRMNL device settings](issues/16-confirm-trmnl-device-settings.md): Screenshot plugin on a TRMNL OG, firmware 1.8.18, 4-grey palette; Maximum Compatibility assumed off; the device refreshes every 15 minutes, not 30.
- [Preparing dark artwork for the 2-bit panel](issues/20-preparing-dark-artwork-for-the-2-bit-panel.md): lift dark posters with an adaptive brightness curve before dithering to the four even greys; no published grey values exist for the panel; white-area specks are ghosting.
- [Spotlight screen on 2-bit e-ink](issues/11-spotlight-screen-on-2-bit-e-ink.md): full-height poster on the left, text column, rail of three Medium cards with uncropped thumbnails; TRMNL's fonts with an Inter title; all ratings as stars; posters dithered by us with a brightness lift, confirmed on the device.
- [TRMNL font licence and hosting](issues/21-trmnl-font-licence-and-hosting.md): the TRMNL fonts are SIL OFL 1.1 and may be used and copied; self-host them with `OFL.txt`, at 12, 16 and 21 px only, unsmoothed; untested through the Screenshot plugin.
- [Trakt client id live check](issues/17-trakt-client-id-live-check.md): a client id alone reads the owner's history and watched shows, and the watched-against-aired comparison is right for a finished and an unfinished show; search returns TMDB ids; `watched_at` is only accurate to the day; Sequel delay not measured.
- [Export history for the consumed set](issues/18-export-history-for-the-consumed-set.md): all 544 films match a TMDB id through their Letterboxd page and all 260 read books carry a Goodreads id; live PSN and Xbox return full history including PC Game Pass; the "also consumed" list starts empty; a few minutes of play or a did-not-finish book is not Consumed; books match by id, then title and author.
- [Failure alerts by Telegram](issues/19-failure-alerts-by-telegram.md): each side alerts for its own jobs and watches the other through Redis; alerts only after a failure persists, with a daily reminder and a recovery message; dated tokens warn 14 and 3 days ahead (PSN is 60 days); Telegram replaces the GitHub issue workflows; a status strip sits below the captured screen.
- [Home collector design](issues/13-home-collector-design.md): a TypeScript `collector/` in this repo run by launchd every 15 minutes; SQLite is its record and it alone writes `home:` keys in Redis; it owns the consumed set; LLM runs use one folder per medium outside the repo with the taste model and a hook enforcing the 100-character reason; nightly snapshot to disk and Redis.
- [Stages and spec](issues/14-stages-and-spec.md): eight stages, each leaving a working device, written as `docs/spec/media-dashboard/`; games, movies, shows, alerts, collector and books, consumed set and Catalog picks, Friend activity, LLM picks.

## Not yet specified

Nothing. Every patch was settled in [Stages and spec](issues/14-stages-and-spec.md) or moved to Out of scope below.

## Out of scope

- Weather, transit, calendar, routines, medication, day types, time blocks and special conditions: all removed, not redesigned.
- Trakt as a source for movies or for friends: the owner logs movies on Letterboxd and has no friends on Trakt.
- Xbox and PSN friends: they provide no rating or comment.
- Moving book tracking to Hardcover or another service: the owner chose to stay on Goodreads.
- Calling Claude from Vercel or through the Agent SDK with subscription credentials: not permitted; only the CLI on the home server is used.
- Open Library as a book Catalog: replaced by Goodreads, which has ratings and descriptions.
- A dismiss button for Recommendations: the hand-edited "also consumed" list is the only way to reject a pick.
- The Goodreads logged-in session and friends' book updates as Friend activity: a later effort, undecided in detail. If the Goodreads widget is retired it becomes the replacement for the books source.
- Steam friends' reviews as Friend activity: a later effort.
- Keeping watchlists and to-read shelves current so a listed title is not recommended: a later effort.
- A more convenient way to edit taste models and "also consumed" files than SSH: a later effort.
- Taste models for movies and shows: the owner writes them whenever they like; no build work.
