# How Switch joins the game sources

Type: grilling
Status: resolved

## Question

The [Nintendo Play Activity test](12-nintendo-play-activity-test.md) passed. How does Switch become a fourth game source?

- **Where it is fetched**: Vercel with the session token as an environment variable, or the home collector. Reaching the endpoint from a datacenter IP is untested, and the home server already holds the token.
- **In progress for Switch**: `lastPlayedAt` gives the 14-day rule directly; decide whether the per-day minutes are shown.
- **Merging**: a title can appear on Switch and another platform, and Switch 2 editions carry long names ("... – Nintendo Switch 2 Edition"). Decide how titles are matched and how names are shortened.
- **Artwork**: Nintendo's image is a 512-pixel icon. Decide whether the Spotlight uses it or an IGDB cover.
- **Token expiry**: the session token lasts until 2028-11-16; decide how its renewal is flagged.
- **Stage**: whether Switch still ships as a later stage now that the risk is gone.

## Answer

The owner accepted all six proposals on 2026-11-17.

- **Where it is fetched**: Vercel, alongside Steam, Xbox and PSN, with the session token as an environment variable. The work starts with a one-request check that Nintendo answers from Vercel. If it does not, Switch moves to the home collector, which is known to work.
- **One Title per game**: a game played on several platforms, or on both Switch and Switch 2, is one Title, showing the platform it was most recently played on. This extends the existing name-based merge.
- **Name cleaning**: for matching and display, drop platform wording ("– Nintendo Switch 2 Edition" and anything after it, "for Nintendo Switch") and fix all-caps names.
- **Artwork**: a game in the Spotlight uses the IGDB cover on every platform. The platform's own image is the fallback when IGDB has no match. Nintendo's image is a square icon, available at 512 and 1024 pixels from a public server.
- **What is shown**: last played and total hours, the same as other platforms. The per-day minutes are ignored.
- **Stage**: Switch ships in the same stage as the other three game sources.

Facts found while resolving this:

- The data appears to update once a day (`lastUpdatedAt` is midnight, a day after the last play), so fetching more than hourly gains nothing.
- The owner's account is US-region. `en-GB` works as the locale; `en-US` is untested.
- IGDB matching for Switch titles will be by name, per [Catalog capabilities](07-catalog-capabilities.md).

Defaults taken without a question, to revisit if they look wrong on the device: the older "Nintendo Classics" collections appear as ordinary titles, and titles hidden on the Nintendo profile stay hidden. How the token's 2028 expiry is flagged belongs to the source health page, which is still in the map's Not yet specified.
