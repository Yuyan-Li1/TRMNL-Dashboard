# Nintendo Play Activity test

Type: task
Status: resolved

## Question

Does the unofficial Nintendo Play Activity endpoint return play history for the owner's account (US region, used from Australia)?

Human in the loop: the owner signs in to their Nintendo account once in a browser so a session token can be obtained.

Record: whether titles are returned, whether Switch 2 titles appear, which fields come back (name, image, last played, total minutes), and where the session token is kept. If it fails, try the Parental Controls route and record that result. The outcome decides whether Switch becomes a fourth game source.

Background: the route uses `app-api.znej.nintendo.com`, needs no token-signing service, and its session token lasts about two years. The only known library is `wolveix/nintendo-go`, marked experimental, and it is unconfirmed for non-Japanese accounts.

## Answer

Tested on 2026-11-17 from the owner's Mac (residential Australian IP). **It works for the owner's account, which is a US-region Nintendo account used from Australia**, so the Parental Controls fallback was not needed.

- **Sign-in**: one browser sign-in, copying the address of the "Select this person" button, then exchanging the code. No token-signing service is involved.
- **Session token**: stored at `~/.config/trmnl-dashboard/nintendo-session-token`, readable only by the owner. It expires on 2028-11-16. Access tokens derived from it last 15 minutes.
- **Request**: `GET https://app-api.znej.nintendo.com/api/v2.0/users/me/play_histories` with the access token as a bearer token and a `Gentry-Locale` header. `en-AU` returned 400; `en-GB` returned 200. `en-US` was not tried and is the natural locale for a US-region account.
- **Data**: 28 titles in one response. Each has `titleId`, `titleName`, `platform`, `imageUrl`, `firstPlayedAt`, `lastPlayedAt`, `lastUpdatedAt`, `totalPlayedDays` and `totalPlayedMinutes`. Every title had an image.
- **Switch 2 titles appear**: `platform` is `BEE` for Switch 2 (5 titles) and `HAC` for the original Switch (23 titles).
- **Recent days**: `recentPlayHistories` held 4 days, each with per-title minutes. That is the only per-day figure.
- **Images**: URLs end in a size suffix, for example `..._512`. Whether larger sizes or cover-shaped art exist was not checked.
- **Not tested**: whether the endpoint answers from a datacenter IP such as Vercel.
- **How it was run**: a throwaway Node script written from the source of `wolveix/nintendo-go`; the library itself was not used. The script and raw response are in the session scratchpad and are not kept.

Switch becomes a fourth game source. How it is fetched and merged is in [How Switch joins the game sources](15-how-switch-joins-the-game-sources.md).
