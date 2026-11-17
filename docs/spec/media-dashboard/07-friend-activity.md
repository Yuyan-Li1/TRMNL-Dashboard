# Stage 7: Friend activity

Read [the overview](README.md) first. This stage adds the Friend activity Mode: what the people the owner follows on Letterboxd said about a movie, whether or not the owner has Consumed it.

## Slices

### 1. Collector job

One job, every 6 hours:

- Read the owner's public following page on Letterboxd. It exposes up to 25 people without a browser; the owner follows fewer. These are the Friends.
- Read each Friend's public diary feed, in the same format as the owner's (stage 2).
- Keep entries from the last 14 days that have a rating or a review. An entry is kept even when the owner has already logged that movie.
- Publish them under `home:`: the TMDB id, the Friend's name, the rating, the review text, whether the review is marked as containing spoilers, and the date.
- A failed read keeps the last good data. It alerts after 2 failed reads in a row (12 hours), as for Goodreads.

### 2. Friend activity on the screen

- Vercel adds the TMDB poster, year and director by id during its refresh.
- **The spoiler rule**: a review marked as containing spoilers shows its text only if the movie is in the owner's consumed set (stage 6). Otherwise only the rating and the Friend's name are shown, with the TMDB overview in place of the review.
- **A Friend activity Spotlight**: Mode label "Friend activity" with "Movie"; title; byline is year and director; the Friend's rating as stars followed by the Friend's name; the fact is when they logged it; then the review, up to 280 characters.
- The Mode takes its 20% share when any entry is eligible. Fresher entries are favoured.
- Friend activity never appears on a Medium card; cards show only the owner's activity.

## Device check

- A 280-character review fits the text column, and a spoiler review of a movie the owner has not seen shows no review text.
