# Catalog capabilities: TMDB, IGDB, Open Library (and Google Books)

Research date: 2026-11-17. Throwaway research note; not merged.

**Question.** What can each Catalog supply (artwork, public rating, description, per-title recommendations, existence check for an LLM-named title), and under what limits?

**Evidence labels**

- **[fetch]** verified by a live call made during this research (unauthenticated only; no API keys were used).
- **[docs]** read from the official documentation or terms page cited.
- **[forum]** first-party staff statement on the vendor's forum, not in the reference docs.
- **[unconfirmed]** from memory or inference; not verified here. Needs a keyed call before relying on it.

TMDB and IGDB API responses could not be fetched live: both return `401` without credentials **[fetch]**. Their image CDNs are public and were fetched.

## Summary

| Catalog | (a) Confirm an LLM-named title exists | (b) Artwork | (b) Public rating | (b) Short description | Seeded recommendations | Auth | Stated limit |
|---|---|---|---|---|---|---|---|
| TMDB | Yes (search by title + year) | Yes | Yes (`vote_average`, 0-10) | Yes (`overview`) | Yes (`/recommendations`, `/similar`) | Free key or bearer token | ~40 req/s |
| IGDB | Yes (`search` or `where name`) | Yes | Yes (`total_rating`, 0-100) | Yes (`summary`) | Yes (`similar_games`) | Twitch app token (~60 days) | 4 req/s, 8 open |
| Open Library | Yes (search by title + author) | Usually | Thin (few votes) | Patchy; extra call | No per-title endpoint found | None | 1 req/s, 3 req/s identified |
| Google Books | Yes, with a key | Yes (small) | Field exists; often absent | Yes (HTML) | No | Key required in practice | Keyless quota is 0 |

Two findings that affect the plan more than the rest:

1. **TMDB's terms restrict AI/LLM use.** The API terms forbid using the API or content "in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application" (see TMDB terms below). Confirming LLM-named titles against TMDB sits close to that clause. This is a terms question for the owner to decide, not something this note can settle.
2. **Google Books is not usable keyless.** Every unauthenticated call returned `429` with `quota_limit_value: 0` **[fetch]**.

At a 15-minute refresh (96 runs/day) none of the stated rate limits is a practical constraint, provided catalog results are cached per title rather than re-fetched each run.

## TMDB (movies and shows)

Base: `https://api.themoviedb.org/3`

### Lookup and search

- Movie by TMDB id: `GET /3/movie/{movie_id}`. Response includes `overview`, `poster_path`, `vote_average`, `vote_count`, `tagline`, `imdb_id`, `release_date`. Supports `append_to_response` ("comma separated list of endpoints within this namespace, 20 items max"), so details plus recommendations can be one request. **[docs]** https://developer.themoviedb.org/reference/movie-details
- Show by TMDB id: `GET /3/tv/{series_id}` **[unconfirmed]** (path inferred from the sibling TV endpoints below; details page not fetched).
- Movie and TV ids are separate id spaces, so a TMDB id is only usable together with its media type. **[unconfirmed]** Letterboxd is movies only; Trakt labels each item as movie or show.
- Movie search: `GET /3/search/movie`, "Search for movies by their original, translated and alternative titles." Params: `query` (required), `year`, `primary_release_year`, `region`, `language` (default `en-US`), `include_adult` (default `false`), `page`. Each result carries `id`, `title`, `original_title`, `release_date`, `overview`, `poster_path`, `vote_average`, `vote_count`, `popularity`. **[docs]** https://developer.themoviedb.org/reference/search-movie
- TV search: `GET /3/search/tv`, "Search for TV shows by their original, translated and also known as names." Params: `query` (required), `first_air_date_year`, `year` (matches first air date and all episode air dates), `language`, `include_adult`, `page`. **[docs]** https://developer.themoviedb.org/reference/search-tv
- `GET /3/find/{external_id}` resolves `imdb_id`, `tvdb_id`, `wikidata_id` and social ids. It is not needed when a TMDB id is already in hand. **[docs]** https://developer.themoviedb.org/reference/find-by-id
- Response for an id that does not exist: not documented. Expected `404` with `status_code: 34`. **[unconfirmed]**

### Recommendations versus similar

- `GET /3/movie/{movie_id}/recommendations` and `GET /3/tv/{series_id}/recommendations`. Params `language`, `page`. The reference pages carry no description of how results are produced. **[docs]** https://developer.themoviedb.org/reference/movie-recommendations , https://developer.themoviedb.org/reference/tv-series-recommendations
- `GET /3/movie/{movie_id}/similar`: "Get the similar movies based on genres and keywords." with the note "This method only looks for other items based on genres and plot keywords." **[docs]** https://developer.themoviedb.org/reference/movie-similar
- `GET /3/tv/{series_id}/similar`: "Get the similar TV shows." **[docs]** https://developer.themoviedb.org/reference/tv-series-similar
- The difference: similar is content-based (genres and keywords); recommendations are behaviour-based, built from other users' ratings of the item. This is stated only by TMDB staff on the forum, in posts dated 2016 to 2019, not in the reference docs. **[forum]** https://www.themoviedb.org/talk/58389bec925141423f00273c , https://www.themoviedb.org/talk/5b70fd3fc3a368189916a57f
- Consequence for "because you watched X": recommendations is the better seed endpoint. Obscure titles with few ratings may return an empty list, with similar as the fallback. **[unconfirmed]**
- Result items in both lists are expected to have the same shape as search results (poster, rating, overview included), so no second call per recommended title. The docs schema for recommendations is empty. **[unconfirmed]**

### Rating, overview, images

- Public rating: `vote_average` (number) with `vote_count` (integer). **[docs]** Scale is 0 to 10. **[unconfirmed]** (docs example shows `8.2`).
- Description: `overview` (string), localised by the `language` param. **[docs]** No length cap is documented; truncation is the caller's job.
- Image URL = `base_url` + `file_size` + `file_path`, for example `https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg`. Base URL and sizes come from `GET /3/configuration`. **[docs]** https://developer.themoviedb.org/docs/image-basics
- `secure_base_url`: `https://image.tmdb.org/t/p/`. `poster_sizes`: `w92`, `w154`, `w185`, `w342`, `w500`, `w780`, `original`. **[docs]** https://developer.themoviedb.org/reference/configuration-details
- All six fixed-width poster sizes returned `200 image/jpeg` without credentials for the docs' example poster; widths matched the size names (for example `w185` is 185x278, `w342` is 342x513). **[fetch]**
- `poster_path` can be null for titles with no poster. **[unconfirmed]**

### Authentication

- Either a bearer token (the "API Read Access Token" sent as `Authorization: Bearer ...`) or an `api_key` query parameter. "Both authentication methods provide the same level of access." **[docs]** https://developer.themoviedb.org/docs/authentication-application
- Both come from the API section of a free TMDB account's settings. **[docs]**
- The API returns `401` with no credentials. **[fetch]**

### Rate limits

- The old limit of 40 requests per 10 seconds was disabled on 16 December 2019. Current limits sit "somewhere in the 40 requests per second range", "This limit could change at any time", and callers should "respect the `429` if you receive one." **[docs]** https://developer.themoviedb.org/docs/rate-limiting
- No daily quota is stated. **[docs]**

### Terms for a personal, non-commercial project

- Free "for non-commercial purposes as long as you attribute TMDB". A project is commercial if "the primary purpose is to create revenue for the benefit of the owner". **[docs]** https://developer.themoviedb.org/docs/faq
- Attribution: use the TMDB logo, less prominent than the application's own mark, and place the notice "This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." The FAQ asks for it in an "About" or "Credits" section. **[docs]** https://www.themoviedb.org/api-terms-of-use , https://developer.themoviedb.org/docs/faq
- The e-ink screen itself has little room for a logo; whether attribution on the admin UI or README satisfies "prominently in or on Your Application" is not addressed. **[unconfirmed]**
- Caching: must not "Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs." Redis `:latest` fallback keys never expire, so catalog entries need a refresh path. **[docs]** https://www.themoviedb.org/api-terms-of-use
- AI restriction, section 1.C: must not "Use the TMDB APIs or TMDB Content in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application." Section 2 additionally lists as commercial use: using TMDB "on or in connection with a ... interactive query-response system (including large language model (LLM) ...)", and "Training or validating a machine learning or artificial intelligence system (including large language models and Chatbots) using TMDB content". **[docs]** https://www.themoviedb.org/api-terms-of-use
- How that clause applies to "an LLM names a title, TMDB confirms it" is not stated. The narrowest reading (do not feed TMDB content into the model) is compatible with sending only the logged titles to the LLM and using TMDB afterwards; the broadest reading ("in connection with ... an AI based Application") is not. **[unconfirmed]**

### Verdict

- (a) Confirm an LLM-named title exists: **yes**, via `/search/movie` or `/search/tv` with title and year. Technically sound; see the AI clause above.
- (b) Artwork, public rating, short description: **yes**, all three in the search result itself.

## IGDB (games)

Base: `https://api.igdb.com/v4`, all requests are `POST` with a query body. Source for everything marked [docs] in this section: https://api-docs.igdb.com/ (fetched as raw HTML; the page blocks the fetch tool but serves a browser User-Agent).

### Game fields

- `similar_games`: "Array of Game IDs", described only as "Similar games". How they are computed is not documented. **[docs]**
- `rating` / `rating_count`: "Average IGDB user rating" / "Total number of IGDB user ratings". **[docs]**
- `aggregated_rating` / `aggregated_rating_count`: "Rating based on external critic scores" / "Number of external critic scores". **[docs]**
- `total_rating` / `total_rating_count`: "Average rating based on both IGDB user and external critic scores" / "Total number of user and external critic scores". **[docs]**
- Ratings are on a 0 to 100 scale. **[unconfirmed]** All rating fields are absent on games with no ratings. **[unconfirmed]**
- `summary`: "A description of the game". `storyline`: "A short description of a games story". **[docs]** Despite the wording, `summary` is the general-purpose blurb and `storyline` is often missing. **[unconfirmed]**
- Field expansion lets one request return nested data, for example `fields name, summary, total_rating, cover.image_id, similar_games.name, similar_games.cover.image_id;`. The FAQ gives `fields *, cover.*;` as the pattern. **[docs]**
- Default page size 10, maximum `limit` 500. **[docs]**

### Cover art

- URL structure: `https://images.igdb.com/igdb/image/upload/t_{size}/{hash}.jpg`, where "hash is the id of the image" (the `image_id` field of the cover). **[docs]**
- The API's own `url` field is protocol-relative and uses `t_thumb`; "To request larger image sizes you should manually create your own image url using the image_id and the appropriate image size." **[docs]**
- Sizes: `cover_small` 90x128, `cover_big` 264x374, `logo_med` 284x160, `screenshot_med` 569x320, `screenshot_big` 889x500, `screenshot_huge` 1280x720, `thumb` 90x90, `micro` 35x35, `720p` 1280x720, `1080p` 1920x1080. "by appending _2x to any size, you can get retina (DPR 2.0) sizes (cover_small_2x)". **[docs]**
- `t_cover_small`, `t_cover_big`, `t_cover_big_2x` and `t_720p` all returned `200 image/jpeg` without credentials for the docs' example image id. **[fetch]**

### Matching a Steam, Xbox or PSN title to an IGDB game

- `external_games` endpoint ("Game IDs on other services"). Fields: `game` ("The IGDB ID of the game"), `uid` ("The other services ID for this game"), `name` ("The name of the game according to the other service"), `external_game_source`, `platform`, `url`. **[docs]**
- `category` on `external_games` is deprecated: "Use external_game_source instead". The deprecated enum is still listed: `steam` 1, `gog` 5, `microsoft` 11, `epic_game_store` 26, `xbox_marketplace` 31, `playstation_store_us` 36, `xbox_game_pass_ultimate_cloud` 54, among others. Current ids come from `POST /v4/external_game_sources`. **[docs]**
- Steam: `uid` is expected to be the Steam app id as a string, so the match is `where uid = "<appid>" & external_game_source = <steam id>; fields game;`. Exact and cheap. The numeric id of the Steam source under `external_game_source` was not confirmed, and neither was the uid format. **[unconfirmed]**
- Xbox: sources exist for `microsoft` and `xbox_marketplace`, but which identifier `uid` holds (Store product id versus the title id OpenXBL returns) is not documented. **[unconfirmed]**
- PSN: only `playstation_store_us` appears in the listed enum. Whether its `uid` matches anything the PSN trophy API returns (it returns `npCommunicationId` values, not store ids) is not documented; assume it does not. **[unconfirmed]**
- Name search fallback: `search "Halo"; fields name;` and the docs' example filtering out editions, `search "Assassins Creed"; where version_parent = null;`. **[docs]**
- Practical order: Steam by app id, everything else by name search, with `platforms` and `version_parent = null` as tie-breakers. **[unconfirmed]** as a recommendation; it follows from the gaps above.

### Authentication (Twitch client credentials)

- Register an application in the Twitch developer console to get a client id and secret, then `POST https://id.twitch.tv/oauth2/token` with `client_id`, `client_secret`, `grant_type=client_credentials`. **[docs]** https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
- Response: `access_token`, `expires_in` (seconds), `token_type: bearer`. Twitch's example shows `expires_in: 5011271` (about 58 days), IGDB's shows `5587808` (about 64 days). No refresh token; request a new token with the same call. **[docs]**
- IGDB FAQ: "Your Access Token is only active for 60 days and your application can only have 25 active Access Tokens at one time, going over this limit starts to inactivate older tokens." So the token must be cached (Redis, with TTL from `expires_in`), not requested on every refresh. **[docs]**
- Every request needs two headers: `Client-ID: <client id>` and `Authorization: Bearer <access_token>`. User credentials cannot be used. **[docs]**
- No browser calls: the API does not support CORS; server-side only. **[docs]**
- The API returns `401` with no credentials. **[fetch]**

### Rate limits

- "There is a rate limit of 4 requests per second. If you go over this limit you will receive a response with status code 429 Too Many Requests." **[docs]**
- "You are able to have up to 8 open requests at any moment in time." **[docs]**
- No daily quota is stated. **[docs]**

### Terms

- "The IGDB.com API is free for non-commercial usage under the terms of the Twitch Developer Service Agreement." Commercial use goes through a partnership (partner@igdb.com). **[docs]**
- Caching is encouraged: "Am I allowed to store/cache the data locally? Yes. In fact, we prefer if you store and serve the data to your end users." **[docs]**
- User-facing attribution to IGDB.com is described as a condition of the commercial partnership. No attribution requirement is stated for non-commercial use on the docs page. The Twitch Developer Services Agreement itself was not read. **[docs]** for the first two sentences, **[unconfirmed]** for what the Agreement adds.
- No AI/LLM restriction appears on the docs page; IGDB itself now offers a beta MCP server for AI assistants. **[docs]**

### Verdict

- (a) Confirm an LLM-named title exists: **yes**, by `search` or an exact `where name = "..."` query. Expect editions, remasters and DLC among the hits.
- (b) Artwork, public rating, short description: **yes** (`cover.image_id`, `total_rating`, `summary`), in one request with field expansion. Rating is missing on unrated games.

## Open Library (books, keyless)

### Search

- `GET https://openlibrary.org/search.json?title=...&author=...&limit=N&fields=...`. A query for title "Project Hail Mary" and author "Andy Weir" returned two works, the right one first, with `key`, `title`, `author_name`, `first_publish_year`, `cover_i`, `edition_count`, `isbn`, `ratings_average`, `ratings_count` all populated when requested via `fields`. **[fetch]**
- Default fields (no `fields` param) include `cover_i`, `cover_edition_key`, `author_name`, `first_publish_year`, `edition_count`, `key`, `title`, but not ratings and not a description. Ratings must be requested by name. **[fetch]**
- A nonsense title returned `numFound: 0`. **[fetch]**
- Results are works, not editions, so one hit per book rather than one per printing. **[fetch]**

### Covers

- Pattern: `https://covers.openlibrary.org/b/$key/$value-$size.jpg`; keys `id` (cover id), `olid`, `isbn`, `oclc`, `lccn`; sizes `S`, `M`, `L`. **[docs]** https://openlibrary.org/dev/docs/api/covers
- Measured for cover id `11200092`: S 37x58, M 180x276, L 325x500. An ISBN-keyed L cover of the same book was 265x400, so L is a ceiling, not a fixed size. **[fetch]**
- Each cover request is two redirects to an `archive.org` host. **[fetch]**
- A missing cover returns a blank image with `200` by default; `?default=false` makes it `404`. **[docs]**, both behaviours reproduced **[fetch]**.
- The `olid` key expects an edition OLID. Passing a work OLID (`OL21745884W`) returned a 43-byte blank GIF with `200`. Use `cover_i` with the `id` key. **[fetch]**
- Cover rate limit: for keys other than cover id and OLID, "100 requests/IP are allowed for every 5 minutes", then `403`. Cover-id URLs are exempt. The page asks callers not to crawl the cover API; a link back to Open Library is "appreciated". **[docs]**

### Ratings

- `GET https://openlibrary.org/works/{work_id}/ratings.json` returns `summary.average`, `summary.count`, `summary.sortable` and a 1-to-5 histogram. **[fetch]**
- The same average and count are available in search as `ratings_average` and `ratings_count`, so the separate call is unnecessary. **[fetch]**
- Scale is 1 to 5. Volume is low: a 2021 bestseller with 32 editions had 201 ratings. In a random sample of 15 fantasy works, none had any rating. **[fetch]** (one sample of 15; indicative only)

### Descriptions

- Not in search results. It is on the work record, `GET https://openlibrary.org/works/{work_id}.json`, field `description`, so a second request per book. **[fetch]**
- The field was an object `{"type": "/type/text", "value": "..."}` for the work checked. It can also be a plain string on other records. **[unconfirmed]**
- Text is user-contributed, multi-paragraph, with `\r\n` line breaks; it needs truncating. **[fetch]**
- Coverage is patchy: 4 of 15 random fantasy works had a description, and 7 of 15 had a cover. Popular titles do much better than the long tail. **[fetch]** (one sample of 15; a second sample was cut short by a connection reset)

### Rate limits and User-Agent

- "1 request per second" for unidentified requests; "3 requests per second" for identified ones. Identify with a `User-Agent` naming the application plus a contact email or phone, for example `User-Agent: MyLibraryApp (contact@example.org)`. "Violations may result in aggressive rate limiting or blocking." **[docs]** https://openlibrary.org/developers/api
- No bulk harvesting through the API; use the monthly data dumps for that. Prefer one `search.json` call over many single-book requests. **[docs]**
- No rate-limit headers were present on a search response. **[fetch]**
- Two connection resets occurred during roughly 40 sequential requests at about 1 request per second. Treat the service as occasionally flaky and cache results. **[fetch]**

### Recommendations

- No per-title "similar" or "recommendations" endpoint was found in the developer API index. **[unconfirmed]** (absence not exhaustively checked). Seeded book recommendations would have to come from subjects, authors, or the LLM.

### Verdict

- (a) Confirm an LLM-named title exists: **yes**, title plus author search, keyless.
- (b) Artwork, public rating, short description: **partly**. Artwork usually; rating exists but rests on few votes and is absent for most of the long tail; description costs a second request and is frequently missing.

## Google Books (alternative for ratings and descriptions)

- `GET https://www.googleapis.com/books/v1/volumes?q=intitle:...+inauthor:...`; `isbn:` also supported; keywords are case-sensitive; `maxResults` default 10, maximum 40. **[docs]** https://developers.google.com/books/docs/v1/using
- The docs say public-data requests need an identifier (API key or OAuth token), while also saying "Performing a search does not require authentication". **[docs]**
- In practice keyless calls do not work: three unauthenticated requests (two searches, one volume by id) all returned `429 RESOURCE_EXHAUSTED`, "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'", with `quota_limit_value: "0"` for the shared anonymous project. **[fetch]**
- With a free API key from a Google Cloud project the default quota is expected to be about 1,000 queries per day. **[unconfirmed]** The using guide states no number.
- `volumeInfo.description`: "A synopsis of the volume", formatted in HTML, so tags must be stripped. **[docs]** https://developers.google.com/books/docs/v1/reference/volumes
- `volumeInfo.averageRating`: "The mean review rating for this volume. (min = 1.0, max = 5.0)"; `ratingsCount`. **[docs]** These are often absent on current responses. **[unconfirmed]**
- `imageLinks`: `smallThumbnail` (~80 px wide), `thumbnail` (~128), `small` (~300), `medium` (~575), `large` (~800), `extraLarge` (~1280). **[docs]** Search results usually carry only the two thumbnail sizes; the larger ones appear on the single-volume response. **[unconfirmed]**
- Results are restricted by the caller's IP address. Vercel functions run from non-Australian IPs unless the region is pinned. **[docs]** for the restriction.
- Results are editions (volumes), not works, so the same book appears several times with differing data. **[unconfirmed]**
- Verdict: (a) **yes, with a key**; (b) **description yes, artwork yes but small, rating unreliable**. Its strength over Open Library is publisher-supplied descriptions; it is not a better source of ratings.

No free keyless source with well-populated book ratings was found. Hardcover (GraphQL, token required) is a candidate worth a separate look; nothing about it was verified here. **[unconfirmed]**

## Open questions

- Does TMDB's AI clause permit confirming LLM-named titles? Only TMDB can answer.
- IGDB: the numeric `external_game_source` id for Steam, and what `uid` holds for Microsoft, Xbox and PlayStation sources. One keyed call to `/v4/external_game_sources` and one to `/v4/external_games` settles it.
- TMDB: the response body for a non-existent id, and whether recommendation items carry `overview` and `poster_path`. One keyed call each.
- Google Books: actual daily quota on a keyed project and how often `averageRating` is present.
