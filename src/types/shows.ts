/** One episode in the owner's Trakt history. */
export interface WatchedEpisode {
	/** Trakt's id for the show */
	showId: number;
	showTitle: string;
	/** The year the show first aired */
	year?: number;
	/** Absent when Trakt has no TMDB id for the show */
	tmdbId?: number;
	/** 0 for a special */
	season: number;
	number: number;
	title?: string;
	/** Accurate only to the day: bulk-marking produces false times */
	watchedAt: string;
}

export interface WatchedSeason {
	number: number;
	episodes: { number: number; lastWatchedAt: string }[];
}

/** Which episodes of one show the owner has watched, by season. */
export interface WatchedShow {
	showId: number;
	seasons: WatchedSeason[];
}

/** What the owner has watched, as Trakt has it. */
export interface TraktActivity {
	/** The latest watched episodes, most recently watched first */
	history: WatchedEpisode[];
	/** The watched episodes of every show in `history` */
	watched: WatchedShow[];
}

/** How many episodes a season has, and how many of them have aired. */
export interface SeasonCounts {
	/** 0 for specials */
	number: number;
	episodeCount: number;
	airedEpisodes: number;
}

export interface NextEpisode {
	season: number;
	number: number;
	airsAt?: string;
}

/** What Trakt says about a show's seasons, apart from the owner's activity. */
export interface ShowSchedule {
	seasons: SeasonCounts[];
	/** Null when nothing is scheduled */
	nextEpisode: NextEpisode | null;
	fetchedAt: string;
}

export const SEASON_STATES = ["watching", "caught up", "finished"] as const;
export type SeasonState = (typeof SEASON_STATES)[number];

/** Where the owner is in the latest season they have watched. */
export interface SeasonProgress {
	/** Episodes of the season the owner has watched */
	watched: number;
	/** Episodes of the season that have aired */
	aired: number;
	state: SeasonState;
	/** When the season's last episode was watched; only when finished */
	finishedAt?: string;
}

/** A show the owner has watched, as one entry however many episodes. */
export interface Show {
	/** Trakt's id for the show */
	id: number;
	title: string;
	year?: number;
	tmdbId?: number;
	/** The latest episode watched, specials aside */
	season: number;
	episode: number;
	/** When that episode was watched, accurate only to the day */
	watchedAt: string;
	/** Absent when the show's seasons could not be read */
	progress?: SeasonProgress;
	/** The Catalog description (TMDB overview) */
	overview?: string;
	/** The Catalog's public rating, converted to five stars */
	publicRating?: number;
	/** Source URL of the artwork with a stored Spotlight poster */
	posterUrl?: string;
	/** Source URL of the artwork with a stored thumbnail */
	thumbnailUrl?: string;
}

export interface ShowsData {
	/** Most recently watched first */
	shows: Show[];
	errors: string[];
	fetchedAt: string;
}
