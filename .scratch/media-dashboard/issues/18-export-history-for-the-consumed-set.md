# Export history for the consumed set

Type: task
Assignee: Yuyan Li
Status: resolved

## Question

What do the owner's full Letterboxd and Goodreads histories look like as data, and can each entry be matched to a Catalog id?

Human in the loop: the owner requests a data export from Letterboxd (Settings, Data, Export) and from Goodreads (My Books, Import and export) and hands over the files. They are kept outside the repo.

Record:

- How many films and books each export holds, and which columns it has (title, year, ids, rating, dates).
- Whether a film can be matched to a TMDB id and a book to a Goodreads book id directly, or only by title search, and how many entries fail to match in a sample.
- Whether the live PSN and Xbox sources return the owner's whole play history, including PS5 play after May 2023, or stop short as the exports described in the owner's game taste model did. PC Game Pass play is expected to be missing.
- Which titles therefore need to start on the hand-edited "also consumed" list.

Background: [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md) decided that every Recommendation is checked against a full consumed set per medium, matched by Catalog id. The Letterboxd feed and the Goodreads widget only reach the most recent entries, so the set is seeded once from these exports.

## Answer

Resolved 2026-11-17. The owner supplied both exports and a fresh PSN token; everything was checked live. The files and scripts are in `~/trmnl-media-exports/` on the owner's Mac, outside the repo.

### Letterboxd export

- 544 watched films, 493 diary entries, 406 ratings, 30 watchlist films, 24 reviews.
- `watched.csv` columns: `Date` (the day it was logged, not watched), `Name`, `Year`, `Letterboxd URI`. `ratings.csv` adds `Rating` (0.5 to 5 in half steps). `diary.csv` adds `Rating`, `Rewatch`, `Tags`, `Watched Date`.
- Logged dates are import dates: 380 of the 544 were logged in 2026 and 96 in 2022. Real watch dates exist only in the diary (`Watched Date`, 2016 to 2026), which covers 491 of the 544 films.
- No TMDB id in the export. Every film has a year and a unique `boxd.it` link, and that link's film page carries `data-tmdb-id` and `data-tmdb-type`.
- **Match: 544 of 544** films resolved to a TMDB movie id by fetching the film page, none failed, none were TV entries, no two films shared an id. No title search is needed. The result is saved as `letterboxd-tmdb-map.json`.
- In `watched.csv` the link is the film's; in `diary.csv` and `reviews.csv` it is the diary entry's, so join those to films by name and year.

### Goodreads export

- 472 books: 260 read, 209 to-read, 2 currently-reading, 1 did-not-finish.
- Columns include `Book Id`, `Title`, `Author`, `ISBN`, `ISBN13`, `My Rating`, `Date Read`, `Date Added`, `Exclusive Shelf`, `Read Count`, `Original Publication Year`.
- **Match: 260 of 260** read books carry a Goodreads `Book Id` directly, so nothing needs matching. The id is for the edition the owner shelved, not the work, so a Recommendation for another edition of the same book would not match by id alone.
- 224 of the 260 have `Date Read` (2016 to 2026); the other 36 have only `Date Added`. 237 are rated. Only 204 have an ISBN13, so ISBN is not a usable key.

### Games

- **PSN returns the whole history.** `getUserPlayedGames` pages to 375 entries, last played from 2015-07-11 to 2026-08-09, with play duration and first and last played dates. 91 PS5 titles were last played after May 2023, so the cut-off seen in the old exports does not apply to the live source.
- 14 of the 375 are not games (Plex, Netflix, YouTube and other apps, or category `unknown` and `not_found`); filter on the `category` containing `game`. That leaves 361, of which 70 have under 30 minutes of play.
- The trophy list (`getUserTitles`, 344 titles) is not a substitute but fills gaps: about 25 trophy titles have no counterpart in the played list, mostly games inside collections (Uncharted, Assassin's Creed Ezio, Borderlands, Metro Redux) and Japanese or Chinese-named editions. Seed from the union of both lists.
- The dashboard today calls `getUserTitles` with a limit of 10; the full history needs paging.
- **Xbox** (OpenXBL `player/titleHistory`, one unpaged call) returns 106 titles, last played from 2023-03-14 to 2026-11-16.
- **PC Game Pass play is present**, contrary to expectation: 58 titles list the `PC` device, 7 of them PC only, with `gamePass.isGamePass` and achievements.
- 47 Xbox entries have the device `Win32` only, with no achievements, no product id and `isGamePass: false` (Baldur's Gate 3, The Witcher 3, Pacific Drive). They are PC games from other launchers that the Xbox app saw running. They overlap Steam but also record play Steam does not, so they are worth keeping in the consumed set.
- The response is wrapped as `{ content: { titles }, code }`. `src/lib/api/xbox.ts` reads `titles` at the top level and so gets nothing today.

### The "also consumed" list

No title has to start on it on the evidence of the data: films and books are fully covered by the exports, PSN is complete, and PC Game Pass play shows up through Xbox. The list starts empty and holds only what the owner adds: games played where no source looks.

### Owner's decisions on what the data raised

- Nothing was played on Xbox before March 2023 as far as the owner recalls, so the Xbox history is taken as complete.
- A game with only a few minutes of play does not count as Consumed, and neither does a did-not-finish book. The exact play-time threshold is for Home collector design.
- Books are matched by Goodreads id first, falling back to title and author when the id does not match.
- The exports also hold the watchlist (30 films) and the to-read shelf (209 books), but only as a one-off snapshot; keeping them current is still on the map under Not yet specified.
