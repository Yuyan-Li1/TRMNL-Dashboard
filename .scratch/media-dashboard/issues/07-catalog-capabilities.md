# Catalog capabilities

Type: research
Status: resolved

## Question

What can each Catalog supply, and under what limits?

- **TMDB** (movies and shows): per-title recommendations and similar titles, public rating, overview text, poster sizes, lookup by the TMDB ids that Letterboxd and Trakt provide, authentication and rate limits, attribution requirements.
- **IGDB** (games): similar games, rating, summary, cover art sizes, how a title from Steam, Xbox or PSN is matched to an IGDB entry (external ids versus name search), the Twitch app-token flow and its lifetime, rate limits.
- **Open Library** (books, as a keyless candidate): search by title and author, cover sizes, ratings, description quality, rate limits. Note any better free alternative for book ratings and descriptions.

The answer should say, per Catalog, whether it can confirm that a title named by an LLM really exists and return artwork, a public rating and a short description for it.

## Answer

Full findings: `docs/research/catalog-capabilities.md` on branch `research/catalog-capabilities` (pushed, never merged). No API keys were used, so TMDB and IGDB behaviour is from documentation; only their image servers were fetched. Open questions needing one keyed call each are listed at the end of that file.

- **TMDB** (movies, shows): can confirm a title exists and return a poster, `vote_average` and `overview` from a search result. `/recommendations` is based on user ratings (staff forum posts only); `/similar` is genres and keywords. Free key, about 40 requests per second. Posters from `w92` to `w780`. Attribution notice and logo are required, and caching is capped at 6 months.
- **TMDB terms risk**: the API terms forbid use "in connection with… a machine learning (ML) or artificial intelligence (AI) based Application". Using TMDB to confirm LLM-named titles sits close to that clause. This is the owner's decision, carried into [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md).
- **IGDB** (games): can confirm a title and return `cover.image_id`, `total_rating`, `summary` and `similar_games` in one request. The Twitch app token lasts about 60 days. 4 requests per second. Free for non-commercial use.
- **IGDB matching**: Steam app id through `external_games.uid` is the expected exact match but unconfirmed. Xbox and PSN id matching is undocumented, so plan on name search.
- **Open Library** (books): keyless and can confirm a title. Covers are usually present, up to about 325x500. Ratings are thin (none in a random sample of 15 works) and descriptions were present for 4 of 15 and need a second call. 1 request per second, or 3 with an identifying User-Agent. No recommendations endpoint.
- **Google Books**: needs a key (keyless calls returned 429). Better descriptions than Open Library, but not a better ratings source.
