import type { Poster } from "@/lib/poster/poster";

export const MEDIUMS = ["game", "movie", "show", "book"] as const;
export type Medium = (typeof MEDIUMS)[number];

export const MEDIUM_NAMES: Record<Medium, string> = {
	game: "Game",
	movie: "Movie",
	show: "Show",
	book: "Book",
};

export const MODES = [
	"In progress",
	"Finished",
	"Friend activity",
	"Recommendation",
] as const;
export type Mode = (typeof MODES)[number];

export interface Rating {
	/** Out of five, in half-star steps */
	stars: number;
	/** "You", the friend's name, or the Catalog's name */
	whose: string;
}

/** A Title that can be the Spotlight, in the Mode it would appear in. */
export interface SpotlightCandidate {
	/** Unique across media, e.g. `game:hadesii` */
	id: string;
	medium: Medium;
	mode: Mode;
	title: string;
	/** Author; year and director; Platform; or season */
	byline: string;
	rating?: Rating;
	/** Recommendation only */
	reason?: string;
	facts: string[];
	/** 0-1, where there is progress */
	progress?: number;
	/** The review or description */
	text?: string;
	/** ISO timestamp of the activity that makes it a candidate */
	activityAt: string;
	/** Source URL of the artwork with a stored Spotlight poster */
	posterUrl: string;
}

/** The latest activity for one Medium, however old. */
export interface MediumActivity {
	title: string;
	/** Hours played; episode and "caught up"; page of pages; or "Watched" */
	detail?: string;
	/** ISO timestamp */
	at?: string;
	/** The owner's rating, when the latest activity has one */
	stars?: number;
	/** Source URL of the artwork with a stored thumbnail */
	thumbnailUrl?: string;
}

/** What one Medium contributes to the screen. */
export interface MediumContent {
	medium: Medium;
	/** Titles inside their Spotlight eligibility window */
	eligible: SpotlightCandidate[];
	/** Every Title with artwork, for when nothing at all is eligible */
	fallback: SpotlightCandidate[];
	latest: MediumActivity | null;
}

export interface SpotlightView extends SpotlightCandidate {
	poster: Poster | null;
}

export interface MediumCardView {
	medium: Medium;
	activity: (MediumActivity & { thumbnail: Poster | null }) | null;
}

/** Everything the 800x480 screen renders from. */
export interface ScreenView {
	spotlight: SpotlightView | null;
	/** One card for every Medium not in the Spotlight */
	cards: MediumCardView[];
	now: string;
}
