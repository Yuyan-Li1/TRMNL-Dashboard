# How catalog and LLM recommendations combine

Type: grilling
Blocked by: 07
Status: resolved

## Question

How do Catalog picks and LLM picks together fill the Recommendation mode?

Proposed to the owner: both feed one pool. Catalog picks are labelled "because you watched X" for movies, shows and games. LLM picks span all four media with a one-line reason, and an LLM pick is used only if a Catalog recognises the title. Books use Open Library as their Catalog. If the daily LLM run fails, Catalog picks keep the mode working.

Still to settle once [Catalog capabilities](07-catalog-capabilities.md) reports:

- How many picks per medium the pool holds and how often it is regenerated.
- What history the LLM is given, and whether the owner's ratings are included.
- What the card shows for each origin: the reason line, the public rating, the description length.
- How a recommended title is dropped once the owner logs it.

## Answer

Resolved 2026-11-17 by grilling with the owner. Terms are those in `GLOSSARY.md` (Pool, Catalog pick, LLM pick, Taste model, Consumed).

### Where each medium's picks come from

- **Movies and shows**: Catalog picks from TMDB plus LLM picks. To stay clear of TMDB's AI clause, the LLM never receives TMDB data, and a title it names is confirmed through Trakt search, which returns a TMDB id. TMDB then supplies artwork, rating and overview by id, as it does for the owner's own titles. If Trakt search does not work with a client id alone (to be checked in [Trakt client id live check](17-trakt-client-id-live-check.md)), movies and shows get Catalog picks only.
- **Games**: Catalog picks from IGDB similar games plus LLM picks confirmed by IGDB.
- **Books**: LLM picks only. Goodreads is the book Catalog (average rating, description, cover), looked up by the home collector; an LLM-named book counts only if Goodreads finds it. Open Library is dropped. If the unofficial Goodreads endpoints are retired, books have no Recommendation and the mode skips them.

### The pool

- Up to 5 Catalog picks and 5 LLM picks per medium (books: 5 LLM picks).
- Catalog picks are rebuilt once a day on Vercel. Seeds are titles Finished or In progress in the last 90 days, skipping any the owner rated below 3.5 stars; unrated titles count as liked. TMDB's ratings-based recommendations are used, not "similar".
- A pick leaves the pool at the next refresh once the title appears in the owner's activity (matched by Catalog id), after 3 Spotlight appearances, or after 30 days. It may not return for 6 months.

### The LLM run

- **Input per medium**: the last 50 titles with the owner's ratings and play time, every title recommended before, and the owner's taste model. Taste models exist for games and books; movies and shows run on history alone until the owner writes them.
- **Taste models are authoritative**. They are owner-confirmed and revised often. Recent history shows what is current and what is consumed; it never overrides a taste model rule. The model's own "played", "on hold" and data-reliability sections are treated as exclusions.
- Taste models are written only by the owner, live on the home server outside this repo, and are sent whole.
- **Web search is allowed** for the run, so picks can be checked against the taste model (runback distance, review wording, final boss reputation) and can include recent releases.
- **Limits enforced by the prompt only**: games on PC, PS5, PSVR2 or Switch 2; books available in English unless originally Chinese; no price filter.
- **When it runs**: per medium, only when a title enters or leaves the history, a rating changes, a taste model or "also consumed" list is edited, or fewer than 3 LLM picks remain for that medium. Play time and reading progress do not count as a change. The home server's local log of what was sent decides this.
- **Failure**: existing LLM picks stay until a run succeeds, subject to the retirement rules. Catalog picks carry the mode meanwhile.

### Never recommending a consumed title

- The LLM is asked for 10 picks per medium so that 5 survive. Every pick, Catalog or LLM, is checked against a full consumed set per medium held in Redis and matched by Catalog id.
- The consumed set is seeded from the sources' full histories (Steam, Xbox, PSN, Switch, Trakt) and from one-off Letterboxd and Goodreads data exports, then kept current by polling. Douban history is already in Goodreads and Letterboxd, so no Douban export is needed. See [Export history for the consumed set](18-export-history-for-the-consumed-set.md).
- The home server also keeps a hand-edited "also consumed" list per medium for titles no source records (PC Game Pass play, older PS5 play). Adding a title to it is the only way to reject a pick; the admin area gets no dismiss button.
- Watchlists and to-read shelves are not read in the first build, so a watchlisted title can be recommended. Games the owner owns are excluded even if unplayed.

### What the card shows

- Both origins use the same card with no "AI" label: a reason line, the public rating, and a description cut to about 140 characters.
- Catalog pick reason: "Because you watched X" (or played).
- LLM pick reason: written against the taste model, naming the fit and any warning, for example "Conceit-driven SF; slow first 100 pages, payoff is extraordinary". About 100 characters, enforced as a hard limit by the collector, not only requested in the prompt. The mechanism (a Claude Code hook or a check in the collector) is for [Home collector design](13-home-collector-design.md).
- Final lengths and layout are settled by [Spotlight screen on 2-bit e-ink](11-spotlight-screen-on-2-bit-e-ink.md).

## Comments

- 2026-11-17, owner: yes to one pool fed by Catalog picks and LLM picks, with an LLM pick used only if a Catalog recognises the title.
- 2026-11-17, owner: the home server keeps a local log of what was fed to the LLM. If none of that input has changed since the last run, the job exits before calling Claude, so no tokens are spent producing the same recommendations.
- 2026-11-17, from [Catalog capabilities](07-catalog-capabilities.md), two points this ticket must now settle:
  - TMDB's terms forbid use in connection with an AI-based application. Decide whether LLM-named movies and shows may be confirmed through TMDB, or whether LLM picks are limited to media whose Catalog allows it.
  - No book Catalog gives a reliable public rating or description. Decide what a book Recommendation shows in their place.
- 2026-11-17, from [Goodreads no-login surface](05-goodreads-no-login-surface.md): Goodreads exposes a book's description and average rating without a login. It could be the book Catalog in place of Open Library, fetched by the home collector.
