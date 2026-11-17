# Sources and friends

Type: grilling
Status: resolved

## Question

Where does each medium's activity come from, and where do friends' ratings and comments come from?

## Answer

### One source per medium

- **Movies**: Letterboxd, through the owner's public diary feed. It carries the owner's rating, watched date, rewatch flag, a poster and a TMDB id. Trakt's movie history is ignored.
- **Shows**: Trakt, with a client id only and a public profile. The owner's Trakt data is synced from the Sequel app.
- **Books**: Goodreads. Its shelf feeds were retired around 28 October 2026, so the route is open in [How Goodreads is read](06-how-goodreads-is-read.md).
- **Games**: Steam, Xbox (OpenXBL) and PSN as today. PSN has no unauthenticated route, so the NPSSO token stays. Nintendo Switch is a later addition, gated on [Nintendo Play Activity test](12-nintendo-play-activity-test.md).

### Catalogs

- TMDB for movies and shows, IGDB for games. Each needs one free API key. They supply artwork, public ratings and descriptions.

### Friends

- Friends are everyone the owner follows on Letterboxd (fewer than 25, which is all that the public following page exposes without a browser). The list is re-read daily, and each friend's public diary feed is read for entries.
- Only entries with a rating or a review are eligible.
- A friend's entry is kept even when the owner has already logged that movie.
- A review marked as containing spoilers shows its text only if the owner has logged that movie; otherwise only the rating and the friend's name are shown.
- Steam friends' written reviews also qualify, as a later step. Xbox, PSN and Trakt friends do not.
- Letterboxd's official API is approval-only and declines personal projects, so it is not used.

### Research behind these

- Letterboxd feed: 100 items mixing diary entries and lists; review items are distinguished by a `letterboxd-review-N` guid; full review text is in the description.
- Trakt: history, watched and watchlist endpoints work with a client id; recommendations and per-show progress require OAuth; limit is 500 GETs per 5 minutes.
