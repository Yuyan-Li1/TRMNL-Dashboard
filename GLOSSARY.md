# Media Dashboard

An e-ink display of one person's own media activity: what they are playing, watching and reading.

## Language

**Medium**:
One of the four kinds of thing tracked: game, movie, show or book.
_Avoid_: Category, type

**Source**:
An external service that is the single authority for one medium's activity. Games are the exception: several sources feed the one medium.
_Avoid_: Provider, integration

**Catalog**:
The role of an external service that describes titles (artwork, public rating, description) without regard to the person's activity. A service that is a source for one medium may also act as its catalog.
_Avoid_: Metadata provider

**Platform**:
The system a game was played on, such as Steam, Xbox, PlayStation or Switch. A title shows the platform it was most recently played on.
_Avoid_: Console, device, source

**Title**:
A single game, movie, show or book. A game played on several platforms is one title.
_Avoid_: Item, entry, media

**Spotlight**:
The one large card on the screen, featuring exactly one title with its artwork. It is re-picked each time the device refreshes, favouring fresh activity and never repeating the previous title.
_Avoid_: Hero, featured card, big card, main widget

**Mode**:
The reason a title is in the Spotlight: In progress, Finished, Friend activity or Recommendation.
_Avoid_: State, status, kind

**In progress**:
A mode for a title the person is partway through.
_Avoid_: Now, current, active

**Finished**:
A mode for a title the person recently completed or logged. A show is Finished only when its season or whole run has ended and the person has watched all of it.
_Avoid_: Recent, done, completed

**Caught up**:
The state of a show whose latest aired episode has been watched while its season is still running. It is In progress, never Finished.
_Avoid_: Up to date, finished

**Friend**:
Someone the person follows on a source, whose ratings and comments are shown.
_Avoid_: Follower, contact, user

**Friend activity**:
A mode for a title a friend rated or commented on, whether or not the person has consumed it.
_Avoid_: Friend recommendation, social, feed

**Recommendation**:
A mode for a title the person has not consumed and does not own, suggested from their history and shown with a reason, a rating and a short description.
_Avoid_: Up next, suggestion, backlog pick

**Pool**:
The set of titles currently eligible to appear as a Recommendation. It is filled by catalog picks and LLM picks.
_Avoid_: Queue, list, candidates

**Catalog pick**:
A title in the pool that a catalog suggested because of one title the person finished or has in progress.
_Avoid_: Similar title, algorithmic pick

**LLM pick**:
A title in the pool that a language model named from the person's history and taste model, kept only if a catalog recognises it.
_Avoid_: AI pick, Claude pick

**Taste model**:
A document the person writes describing what they like and dislike in one medium. It is read when LLM picks are made and is never changed by the dashboard.
_Avoid_: Taste profile, preferences, profile

**Consumed**:
Said of a title the person has played, watched or read at any time, whether or not a source recorded it.
_Avoid_: Seen, played, logged

**Collector**:
The program on the owner's home server that reads the sources the dashboard cannot reach, keeps the record of what is Consumed, and makes LLM picks.
_Avoid_: Home server (that is the machine), scraper, worker

**Stale**:
Said of a source whose last good read is older than expected. Its last good data stays on screen.
_Avoid_: Outdated, expired, down

**Alert**:
A message sent to the owner when a failure has persisted, or when a token is about to expire.
_Avoid_: Notification, warning

**Medium card**:
A small card showing the person's latest activity for one medium, however old. Every medium not in the Spotlight has one, so all four media are always on screen.
_Avoid_: Small card, widget, block

**Show**:
A television series, tracked as a whole. Watching several episodes produces one entry for the show, never one per episode.
_Avoid_: Series, episode, TV
