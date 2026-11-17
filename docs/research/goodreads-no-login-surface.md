# Goodreads: what can be read without logging in (one public profile)

Research date: 2026-11-17 (all fetches between 06:48 and 07:10 UTC).
Throwaway research note. Not a design; no code in this repo depends on it yet.

## Legend

- **[V]** verified by live fetch on the research date
- **[D]** from Goodreads' own published text (first-party page, quoted)
- **[U]** unconfirmed (inferred, or could not be tested)

Test profiles (public, well known): user `1` (Otis Chandler, Goodreads founder), user `2`, and
user `4622890` (Emily May, most-followed reviewer, 4,544 books on `read`).

Test client: plain `curl` with no cookies, from an Australian ISP address (AS4804, an
`optusnet.com.au` host), i.e. **not** a datacenter IP. See "Datacenter vs residential" for the one
cloud-origin test that was possible.

## Short answer

| Need | Best unauthenticated source | Status |
|---|---|---|
| Currently-reading list (title, author, cover, review id) | `/review/custom_widget/{id}?shelf=currently-reading` | [V] |
| Read shelf, newest finished first, owner's star rating | `/review/custom_widget/{id}?shelf=read&sort=date_read&order=d` | [V] |
| Reading progress (page X of Y / N%) with timestamp | `/user_status/list/{id}` (HTML) | [V] |
| Date a book was started / last updated | `/user/show/{id}` currently-reading block (max 3 books) | [V] |
| Date a book was finished | **Not available anywhere unauthenticated** | [V] for every surface tested |
| Cover >= 300 px tall | rewrite the size suffix, e.g. `._SY475_.jpg` | [V] |
| Book description, average rating, page count, ISBN | `/book/show/{book_id}` (WAF-challenged under load), `/tooltips`, `/book/auto_complete` | [V] |
| Books-read count for the year, challenge goal | `/user/year_in_books/{year}/{id}`, `/user_challenges/widget/{id}` | [V] |

The single most important operational finding: **`custom_widget` responses are cached server-side
per `(user id path segment, widget_id)` and every other query parameter is ignored on a cache hit.**
Always send a unique `widget_id`. Details below.

## 1. Embeddable widget: `/review/custom_widget/{user_id}`

`GET https://www.goodreads.com/review/custom_widget/{numeric_id}?...` returns
`200 text/javascript`: a `var widget_code = '...escaped HTML...'` assignment plus a few lines that
inject it into `#gr_custom_widget_{widget_id}`. [V]

Only the bare numeric id works in the path. `/custom_widget/1-otis-chandler` and
`/custom_widget/2-x` return 404. [V]

### Fields per book [V]

| Field | Where in the markup | Notes |
|---|---|---|
| Title (short) | `div.gr_custom_title_{wid} > a` text | Series suffix stripped: "Tell Me Everything" |
| Title (full) | `title` attribute of the cover link | "Tell Me Everything (Amgash, #5)" |
| Author | `div.gr_custom_author_{wid} > a` text; href is `/author/show/{author_id}.{Name}` | First author only in every sample |
| Cover | `div.gr_custom_book_container_{wid} img[src]` | `..._SY75_.jpg` or `..._SX50_.jpg` by default, `..._SX98_.jpg` with `cover_size=medium` |
| Owner's rating | `div.gr_custom_rating_{wid}`: count of `gr_flat_red_star_active.png` images (0-5); span `title` is the label ("really liked it") | 0 active stars = unrated. Present on `currently-reading` too (always 0 there in samples) |
| Review id | cover and title links: `/review/show/{review_id}` | Stable per (user, book); good dedupe key. The linked page itself requires sign-in (section 6) |
| Review text | `div.gr_custom_review_{wid}` | Only when the owner wrote a review; truncated excerpt; shown by default, hidden with `show_review=0` |
| Shelves/tags | `div.gr_custom_tags_{wid}` ("tagged: arc, 2026, recent, ...") | Only with `show_tags=1` |
| Book id | Not a field. In every sample the cover filename is the book id (`.../books/1726253855l/204811915._SY75_.jpg` -> book `204811915`) | [V] for all samples; [U] as a guarantee (books with no cover presumably use a placeholder image) |

**Not in the widget, with any parameter tried:** date read, date added, date started, reading
progress, page count, ISBN, average rating. Speculative flags `show_date_read`, `show_date_added`,
`show_dates`, `show_date`, `show_isbn`, `show_avg_rating`, `show_num_pages`, `show_shelves` all had
no effect. [V]

The header link text is the profile's display name ("Emily May's books") and its href echoes the
shelf actually served, which is a cheap way to assert you got the shelf you asked for. [V]

### Query parameters [V]

| Parameter | Effect |
|---|---|
| `shelf` | `read`, `currently-reading`, `to-read`, custom exclusive shelves (`did-not-finish`) and custom tag shelves (`2026`) all work. Default when omitted: `read`. Unknown shelf, `#ALL#`, or a comma-joined list returns 200 with zero books |
| `num_books` | Default 5. **Hard cap 100** (101, 250, 1000 all return exactly 100) |
| `sort` | Works: `date_read`, `date_added`, `date_updated`, `date_started`, `date_pub`, `title`, `author`, `rating`, `avg_rating`, `num_pages`, `random`. Default when omitted is identical to `date_added` descending. An unknown value (`bogus`) returned the same list as `date_updated` descending |
| `order` | `d` (descending) / `a` (ascending) |
| `show_author`, `show_title`, `show_rating`, `show_cover`, `show_review` | `0` removes that block. All default to on |
| `show_tags` | `1` adds the "tagged: ..." line. Default off |
| `cover_size` | `medium` -> `_SX98_` covers. `small` / `large` / omitted -> `_SY75_` (or `_SX50_`) |
| `widget_id` | Suffix appended to every CSS class and the target div id. **Also part of the server cache key** (below) |
| `page`, `per_page`, `header_text` | Ignored. There is no pagination: 100 books is the most one shelf+sort can return |
| `cover_position`, `widget_bg_color`, `widget_text_color`, `widget_width`, `widget_title_size`, `widget_border_width`, `widget_bg_transparent` | Accepted (these are what the classic widget builder emitted); no visible effect on the returned markup. [V] accepted, [U] any effect |

### Server-side cache: parameters are ignored on a hit [V]

Observed directly:

1. The first request this session made for user `1` was `?shelf=currently-reading&num_books=100`.
   For the next 19 minutes, **every** request to `/custom_widget/1` without a `widget_id`
   (`?shelf=read`, `?shelf=to-read`, `?shelf=read&sort=date_read&order=d`, no parameters at all,
   `.js`/`.xml` suffix, trailing slash) returned the byte-identical currently-reading payload.
2. User `2`: first request `shelf=read&num_books=7`; a following `shelf=currently-reading&num_books=2`
   returned the same 7 read books.
3. The cache is shared across clients and IPs: a request for `/custom_widget/2?shelf=to-read`
   made from a Google Cloud IP (via a hosted reader service) returned the 7-book `read` payload
   that the ISP-side request had populated. No cookies involved; CloudFront reported
   `x-cache: Miss`, so the cache is in the Goodreads application, not the CDN.
4. Key = literal id string in the path + `widget_id`:
   - `widget_id=7` with `num_books=2`, then `widget_id=7` with `num_books=4` -> still 2 books.
     `widget_id=8` with `num_books=5` -> 5 books.
   - Zero-padding the id (`/custom_widget/02`, `/custom_widget/004622890`) resolves to the same
     user but is a separate cache entry.
5. TTL: still serving the cached entry about 19 minutes after it was created (06:48 -> 07:08 UTC).
   Upper bound not measured. [U]

Consequences for a collector:

- **Always send a `widget_id`**, and use a different one per distinct query (e.g. one fixed value
  for the currently-reading query and another for the read query), or a fresh value per poll
  (timestamp) to defeat the cache entirely. Both behaviours verified.
- The earlier research fetch (`?shelf=currently-reading&num_books=100`, no `widget_id`) only
  "worked" because nothing else had populated that key. Anyone else embedding the same profile's
  widget without a `widget_id` can poison it.
- Whether a fresh `widget_id` also means fresh *data* (i.e. how quickly a newly shelved book shows
  up) could not be tested without owning an account. [U]

### Sibling: `/review/grid_widget/{user_id}` [V]

Covers-only grid, same `shelf` / `sort` / `order` / `num_books` parameters.

- Per book: full title (in `title`/`alt`), cover, `/review/show/{review_id}` link. No author, no
  rating, no dates.
- **Cap is 200 books** (`num_books=1000` -> 200), double the custom widget.
- Not affected by the cache above in testing: two requests with the same `widget_id` and different
  `num_books` returned different results.
- Useful as a cheap "has anything changed" probe or to see 200 deep into the read shelf.

## 2. Public profile page: `/user/show/{user_id}`

`GET https://www.goodreads.com/user/show/{id}` -> 301 to `/user/show/{id}-{slug}` -> 200 HTML
(about 120-150 KB, legacy server-rendered markup, no JSON blob). [V]

### Currently-reading block (`#currentlyReadingReviews`) [V]

Per book (`div.Updates`):

| Field | Selector |
|---|---|
| Title | `a.bookTitle` (short title); `title` attr of cover link |
| Book id + slug | `a.bookTitle[href]` = `/book/show/{book_id}-{slug}` (a real book link, unlike the widget) |
| Author | `a.authorName` (+ `/author/show/{id}`) |
| Cover | `.firstcol img[src]`, `_SX98_` |
| Shelves | "bookshelves:" links |
| Timestamp | `a.updatedTimestamp` text; href is `/review/show/{review_id}` |

- The timestamp is absolute (`Nov 10, 2026 10:04PM`) for older entries and **relative**
  (`21 hours, 40 min ago`) for recent ones. Timezone of the absolute form is not stated. [V] format,
  [U] timezone. It appears to be the time the book was put on / last updated on the shelf.
- **Only the 3 most recent books are shown** ("See all 10 books that Otis is reading..." links to
  the sign-in-walled shelf). The widget returned all 10. [V]
- **No reading progress in this block** for the two profiles sampled, even though one of them
  posts page-number updates. A `div.greyText` inside each entry was empty in every sample; whether
  it is ever populated with progress is [U].
- **No owner rating** here (the stars shown are the visitor's "Rate this book" control). [V]

### Read shelf on the profile [V]

There is **no read-shelf listing** on the unauthenticated profile. What exists:

- Shelf names with counts (`read (4544)`, `currently-reading (2)`, every custom shelf). The
  `read` count incrementing is a usable "something was finished" signal.
- Totals: "4998 ratings (3.35 avg)", "2345 reviews".
- An optional "favorite books" / featured-shelf cover strip (`#featured_shelf`): covers with
  "Title by Author" in `alt`, `_SY75_`, `/book/show/` links, no ratings or dates.
- No "recent updates" feed is rendered for signed-out visitors.
- Other blocks: quotes, groups, friends, favourite genres, a link to Year in Books, Kindle notes
  and highlights (if the owner made them public).

All shelf links on the profile (`/review/list/{id}?shelf=...`) redirect to `/user/sign_in`. [V]

## 3. Cover image sizes [V]

Cover URLs look like
`https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/{ts}{l|i}/{book_id}._SY75_.jpg`.
The `._XXnn_.` segment is the Amazon image-resizer suffix and can be freely rewritten. Tested on
book `204811915` (original 1688 x 2550):

| Suffix | Result (W x H) | Bytes |
|---|---|---|
| `._SX50_.` | 50 x 76 | 1.9 KB |
| `._SY75_.` | 50 x 75 | 1.8 KB |
| `._SX98_.` | 98 x 148 | 4.8 KB |
| `._SY300_.` | 199 x 300 | 12.7 KB |
| `._SY475_.` | 314 x 475 | 24.7 KB |
| `._SY480_.` / `._SX318_.` | 318 x 480 | 25.6 KB |
| `._SY480_QL80_.` (JPEG quality 80) | 318 x 480 | 24.1 KB |
| `._SX300_SY480_.` (fit inside box) | 300 x 453 | 24.2 KB |
| `._SY600_.` | 397 x 600 | 34.4 KB |
| `._SY1000_.` | 662 x 1000 | 67.6 KB |
| `._SY5000_.` | 1688 x 2550 (original, not upscaled) | 540 KB |
| none (`{book_id}.jpg`) | 1688 x 2550 (original) | 540 KB |

- `SY` = target height, `SX` = target width, aspect ratio preserved. `._SY480_.` exactly fills the
  480 px panel height.
- **The resizer never upscales.** An older book (`17447501`) has a 314 x 475 original, and both
  `._SY480_.` and the bare URL return 314 x 475. So ">= 300 px tall" holds for these samples but a
  very old/small upload could be smaller; check the returned dimensions. [V] no-upscale, [U] how
  small originals get.
- Same path works on `m.media-amazon.com/images/S/compressed.photo.goodreads.com/...` (the host
  the new book pages use), and the `l` vs `i` letter after the timestamp is interchangeable. [V]
- Image hosts were never challenged or rate-limited in testing, and need no user-agent. [V]
- A wrong timestamp/id path returns 403, so URLs must be taken from a page, not constructed. [V]

## 4. Detecting a newly finished book

- `shelf=read&sort=date_read&order=d` works and returns the most recently read first; `order=a`
  returns the oldest (verified: ascending gave childhood-era books, descending gave 2026 reads). [V]
- `sort=date_added&order=d` (also the default) and `sort=date_updated&order=d` also work and give
  *different* top-N lists from `date_read`. [V]
- Up to **100** books per request (custom widget) or **200** (grid widget). No paging. [V]
- **No date is returned**, so "newly finished" must be inferred by diffing review ids between
  polls, not read off the response. [V]
- Where a book with no "date read" set lands in the `date_read` ordering is [U]. Safer detector:
  poll `date_read d` and `date_updated d` (small `num_books`, e.g. 10 each), union the review ids,
  and treat any id not seen before as newly finished. The `read (N)` count on the profile and the
  "N books read" on Year in Books are independent cross-checks.
- The finish date itself is not exposed; the collector's own first-seen timestamp is the best
  available stand-in. [V] that no surface tested exposes it.
- A status update of "finished" was **not** observed in `/user_status/list` (only progress and
  "is starting" entries, section 6), so that page does not signal completion. [V] for two profiles.

## 5. Datacenter vs residential

What was tested:

- **ISP / non-datacenter IP (AS4804, Australia), plain curl, no cookies**: every surface in this
  note returned 200, with a Chrome user-agent, with `curl/8.7.1`, and with `node` as the
  user-agent. [V]
- **Google Cloud IP (AS396982, 34.96.x.x, confirmed via an IP-echo page) through a hosted reader
  service**: `custom_widget`, `/user/show`, `/user_status/list` and `/book/show` all returned real
  content. Caveat: that service drives a real headless browser, so it would pass a JavaScript
  challenge that a plain `fetch` would fail. [V] with that caveat.

What could not be tested: [U]

- A plain HTTP client (no JS) from a datacenter IP.
- AWS address space specifically, which is what Vercel functions egress from (Goodreads is itself
  behind CloudFront + AWS WAF).
- Sustained polling over days from either kind of IP.

Bot protection actually observed [V]:

- `/book/show/{id}` is behind an **AWS WAF JavaScript challenge**. The challenge response is
  `HTTP 202`, `content-length: 0`, `x-amzn-waf-action: challenge`. It appeared intermittently
  from the start (the very first `/book/show` request, made inside a burst of ~24 requests to
  other paths, was challenged; the next 11 spaced requests were 200) and then persistently
  (12 of 12) once the session had made on the order of 150 requests to the site in ~15 minutes.
  A plain HTTP client cannot solve this challenge.
- In the same window, 12 back-to-back requests each to `custom_widget`, `grid_widget`,
  `/user_status/list`, `/user/year_in_books` and `/book/auto_complete` were all 200, and
  `/user/show` was 11 x 200 plus one connection failure. The widget endpoints sent
  `x-frame-options: ALLOWALL` and were never challenged.
- `robots.txt` disallows `/review/list`, `/review/show`, `/user/updates_rss`, `/review/list_rss`,
  `/tooltips`, `/search`, `/user/year_in_books`, `/api` for generic agents. It does not mention
  `/review/custom_widget`, `/review/grid_widget`, `/user/show` or `/user_status`. [V]

Reading: the widget endpoints are designed to be loaded by arbitrary third-party pages and showed
no IP sensitivity; the home-server collector is still the lower-risk place to poll from, and is
the only sensible place for anything touching `/book/show`.

## 6. Other unauthenticated surfaces

### Works

| Surface | What it gives | Notes |
|---|---|---|
| `/user_status/list/{id}` | **Reading progress.** 30 entries per page (`?page=N`), newest first. Each: "is on page 652 of 864 of {full title}" or "is 81% done with {title}" or "is starting {title}", optional comment text, `/book/show/{book_id}-{slug}` link, `_SY75_` cover, absolute timestamp (`Sep 16, 2026 06:55AM`), status id | [V]. Only exists if the owner posts progress updates. Join to the widget by book id. Timezone of timestamp [U] |
| `/user_status/show/{status_id}` | One progress update, same fields | [V] |
| `/book/show/{book_id}` | Next.js page. `<script type="application/ld+json">`: name, image (full-size cover URL), bookFormat, numberOfPages, inLanguage, isbn, awards, author, aggregateRating (ratingValue, ratingCount, reviewCount). `__NEXT_DATA__` Apollo state adds description (HTML and stripped), genres, publisher, publication time, series, rating distribution | [V] content; ~770 KB per page; **WAF-challenged under load** (section 5) |
| `/book/isbn/{isbn13}` | Redirects to the `/book/show/` page | [V] redirect |
| `/tooltips?resources[Book.{id}][type]=Book&resources[Book.{id}][id]={id}` | JSON `{tooltips: {"Book.{id}": "<html>"}}` with full title, author, average rating, ratings count, publication year and the description. 2.5 KB | [V]. Disallowed in robots.txt. Lightest way to get description + average rating |
| `/book/auto_complete?format=json&q={title or ISBN}` | JSON array: `bookId`, `workId`, `title`, `bookTitleBare`, `numPages`, `avgRating`, `ratingsCount`, `author{id,name}`, `imageUrl`, truncated `description.html`. ISBN-13 query returned the exact edition first | [V]. 12/12 OK in a burst |
| `/user/year_in_books/{year}/{id}` | Current year works mid-year. "152 books read", "54,058 pages read", shortest/longest book, average length, the owner's average rating for the year, and a cover grid of the year's books (first 99 in the HTML, in reading order starting from the first book of the year, `_SY475_` covers, `/book/show/` links, owner's star rating on the enlarged tiles only) | [V]. No per-book dates. Disallowed in robots.txt for generic agents |
| `/user_challenges/widget/{id}` | JS widget: "has read 11 books toward his goal of 20 books", "11 of 20 (55%)", link to `/user_challenges/{challenge_entry_id}` | [V]. Only if the owner joined the year's Reading Challenge |
| `/user_challenges/{challenge_entry_id}` | "read 11 of 20 books in 2026" plus covers (`_SX98_`, "Title by Author" in alt, `/book/show/` links) of the books counted | [V]. The id is the challenge-entry id from the widget link, not the user id. No dates |
| `/notes/{id}-{slug}` | Public Kindle notes and highlights, if shared | [V] 200, content not examined further |

### Does not work [V]

| Surface | Result |
|---|---|
| `/review/list_rss/{id}?shelf=...` | 404 |
| `/user/updates_rss/{id}` | 404 |
| `/user_status/list/{id}?format=rss` | 406 (the page still links to it) |
| `/quotes/list_rss/{id}` | 404 |
| `/review/list/{id}` (any shelf, `print=true`, `.csv`) | 302 to `/user/sign_in` |
| `/review/list/{id}?format=json` | 406 |
| `/review/show/{review_id}` (the widget's link target; would hold dates read and per-review progress) | 302 to `/user/sign_in` |
| `/review/stats/{id}` | redirect to `/user/new` (sign-up) |
| `/user/show/{id}.xml`, `/review/list/{id}.xml` (old developer API) | 401 |
| `/shelf/list/{id}`, `/shelf/user_shelves/{id}`, `/user/updates_widget/{id}`, `/user/widgets`, `/widgets` | 404 |
| `/review/widgets` (widget builder) | redirect to sign-up; builder is account-only |
| `/api` (old developer docs) | redirects to `/` |

## 7. Signs these surfaces are being retired

- **RSS retirement is official.** Goodreads prepended this notice to its original 2007 feeds
  announcement (<https://www.goodreads.com/blog/show/20-more-rss-feeds>): "Update: RSS feeds are no
  longer available on Goodreads. As of October 2026, RSS feeds have been discontinued. To keep your
  data secure, we retired this low-usage feature. If you'd like to export your shelves or reading
  history, you can use My Books Import & Export." [D], fetched 2026-11-17. A matching help-centre
  announcement titled "RSS Feeds Have Been Retired" was reported by search but not opened. [U]
- **No retirement notice for widgets was found.** That same blog post still describes "our widget"
  as the other way to put your reading on a blog, linking to `/review/widgets`. Two web searches
  found no 2026 deprecation announcement for `custom_widget`. [V] the post text, [U] absence of a
  notice elsewhere.
- Risk signals, all [V] as observations and [U] as predictions:
  - The stated reason ("keep your data secure ... low-usage feature") applies equally to an
    unauthenticated widget that exposes a shelf.
  - The direction of travel is consistent: developer API closed to new keys in December 2020,
    `/api` docs now gone, shelf pages sign-in-walled, RSS removed October 2026.
  - The widget is legacy Rails output (`utm_medium=api`, `document.write`), and the status page
    still links a dead `?format=rss`, i.e. the retirement was done by switching off formats rather
    than by cleaning up. Widgets could disappear the same way, without notice.
  - `/book/show` already sits behind an active WAF challenge.
- Treat every surface here as best-effort: keep last-known-good data (this project's cache already
  does) and alert on a 404 / sign-in redirect / zero-book response.

## 8. Not tested / open questions [U]

- Behaviour for a profile whose privacy is not "anyone": every finding assumes a fully public
  profile.
- Freshness lag between shelving a book and it appearing in the widget (needs an owned account).
- Upper bound of the `custom_widget` cache TTL.
- Timezone of profile and status timestamps.
- Plain-HTTP access from Vercel/AWS IPs.
- Whether the profile's currently-reading block ever shows progress inline.

## Sources

All first-party, fetched 2026-11-17:

- `https://www.goodreads.com/review/custom_widget/{1,2,4622890}` with the parameter sets above
- `https://www.goodreads.com/review/grid_widget/4622890`
- `https://www.goodreads.com/user/show/1`, `https://www.goodreads.com/user/show/4622890`
- `https://www.goodreads.com/user_status/list/1`, `.../4622890`, `/user_status/show/1335438433`
- `https://www.goodreads.com/book/show/204811915`, `/book/auto_complete`, `/tooltips`
- `https://www.goodreads.com/user/year_in_books/2026/4622890`, `/user_challenges/widget/1-otis-chandler`, `/user_challenges/66742326`
- `https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1726253855l/204811915.*.jpg` (size tests)
- `https://www.goodreads.com/robots.txt`
- `https://www.goodreads.com/blog/show/20-more-rss-feeds` (retirement notice)
