# Goodreads no-login surface

Type: research
Status: resolved

## Question

With the shelf feeds retired, exactly what can be read from Goodreads without logging in, for one public profile?

- The embeddable widget (`/review/custom_widget/{id}?shelf=...`) and the public profile page: which fields each returns for the currently-reading and read shelves (title, author, cover, the owner's rating, any dates, any progress).
- Whether the cover URL's size suffix can be changed to get an image large enough for a Spotlight (roughly 300 pixels tall or more).
- Whether the read shelf can be ordered by date read or date added, so a newly finished book can be detected, and how many books are returned.
- Whether these load from a datacenter IP or only from a residential one.
- Any sign that these surfaces are also being retired.

## Answer

Full findings: `docs/research/goodreads-no-login-surface.md` on branch `research/goodreads-no-login-surface` (pushed, never merged). Verified by live fetch from a home internet connection unless marked otherwise; each fact is tagged in that file.

- **Widget** (`/review/custom_widget/{id}`): title, first author, cover, the owner's star rating, review id, optional review excerpt and shelves. No dates, no progress. Parameters: `shelf`, `num_books` (default 5, cap 100, no paging), `sort` (`date_read`, `date_added`, `date_updated`, `date_started`, `rating` and others), `order=a|d`.
- **Widget cache trap**: responses are cached server-side on the id and `widget_id`, and other parameters are ignored on a hit for at least 19 minutes. Send a distinct `widget_id` per query.
- **Reading progress exists without a login**: `/user_status/list/{id}` gives "page X of Y" or "N% done" with timestamps.
- **Profile page**: only the 3 latest currently-reading books, with no rating or progress.
- **Covers**: the size suffix can be rewritten. `._SY480_.` returned 318x480 and `._SY600_.` 397x600. It never upscales.
- **Detecting a newly finished book**: `shelf=read&sort=date_read&order=d` orders correctly, but the finish date itself is not exposed anywhere tested. Compare review ids between polls and record the date first seen.
- **Where it loads from**: everything loaded from a home connection with a plain request. Plain requests from Vercel or another datacenter are untested. Book pages get bot challenges under load; widgets never did.
- **Retirement**: the feed removal is official (a Goodreads blog notice calling it a low-usage feature). No notice was found for widgets, but the same reasoning could apply to them.
- **Book descriptions and average ratings**: available without a login from `/book/show` structured data and from the `/tooltips` and `/book/auto_complete` JSON endpoints. This makes Goodreads itself a candidate book Catalog.
- **Sign-in required**: `/review/show` and `/review/list`.
