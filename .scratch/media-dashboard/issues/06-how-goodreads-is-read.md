# How Goodreads is read

Type: grilling
Blocked by: 05
Assignee: Yuyan Li
Status: resolved

## Question

Which route does the home server use to read the owner's books from Goodreads in the first build?

- **(a) No login**: the public widget and profile page. No dates, so the dashboard records the day it first sees a book on the read list and treats that as the finish date.
- **(b) Logged-in browser session**: adds real dates, reading progress and friends' book updates, but sessions expire and the scrape is the most breakable piece.

Proposed to the owner: (a) first, with (b) and friends' books as a later stage. The answer depends on what [Goodreads no-login surface](05-goodreads-no-login-surface.md) finds, in particular whether a usable cover and a detectable "newly read" signal exist.

## Comments

- 2026-11-17, owner: the end goal is (b), the logged-in session, with (a), the no-login route, as the fallback when the session fails. Not "(a) first, (b) later". Still to settle once the research reports: what (a) can supply on its own, how a broken session is detected, and whether (b) is built in the same stage as (a).
- 2026-11-17, from [Goodreads no-login surface](05-goodreads-no-login-surface.md): the no-login route is stronger than assumed. It gives usable covers (up to about 400x600), the owner's rating, reading progress with timestamps, and a correct newest-first order of the read shelf. It lacks only the finish date, which can be recorded as the day a book is first seen as read. What the logged-in session would add is therefore real finish dates and friends' book updates. Decide whether that is still worth making the session the primary route.

## Answer

Resolved 2026-11-17 with the owner. This replaces the owner's earlier comment that the session is primary and the no-login route its fallback.

- **Two routes, layered**: the no-login route is the always-running baseline. The logged-in session is an optional layer on top that adds only real finish dates and friends' book updates. When the session breaks, the baseline is already running, so nothing switches over.
- **Staging**: the first books stage ships the no-login route only. The session arrives in the later stage that adds friends' book updates as Friend activity.
- **Where it is fetched**: the home server. It is the only tested path, and the session will need it anyway.
- **Polling**: every 6 hours the collector reads the newest books on the read shelf (`sort=date_read&order=d`), the currently-reading shelf and the progress list (`/user_status/list/{id}`), each widget request with its own `widget_id`.
- **Finish date**: the day the collector first sees a book's review id on the read shelf. On the very first run every book already there is recorded as consumed with no finish date, so none appears as Finished.
- **In progress**: a book on the currently-reading shelf is In progress. Its freshness is the latest progress update. With no update in 14 days it is not eligible for the Spotlight but still shows on the books Medium card with its last known progress.
- **Accepted limits**: a reread is not detected as newly Finished. A rating added after finishing appears on the next poll without making the book Finished again.
- **When a read fails**: a read has failed when a request errors or when a shelf that previously had books parses to none. The collector keeps the last good data, books stay on screen, nothing is recorded as newly finished, the source health page marks Goodreads as stale, and an alert is raised (channel and rules in [Failure alerts by Telegram](19-failure-alerts-by-telegram.md)).
- **If the widget is retired**: no second no-login route is built in advance. Books freeze on their last good data and the session stage is pulled forward as the replacement.
- **Fixed now for the session stage**: once the session exists, its real finish date replaces the first-seen date for any book it covers. Everything else about the session is in the map's Not yet specified.
