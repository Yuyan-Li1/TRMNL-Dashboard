/** The systems a game can be played on. */
export const PLATFORMS = [
	"steam",
	"xbox",
	"playstation",
	"switch",
	"switch2",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_NAMES: Record<Platform, string> = {
	steam: "Steam",
	xbox: "Xbox",
	playstation: "PlayStation",
	switch: "Switch",
	switch2: "Switch 2",
};

/** A game is In progress when it was played within this many days. */
export const IN_PROGRESS_DAYS = 14;

/** One source's record of one game, as the source names it. */
export interface PlatformPlay {
	platform: Platform;
	name: string;
	/** ISO timestamp */
	lastPlayedAt?: string;
	minutesPlayed?: number;
	/** The Platform's own image for the game */
	imageUrl?: string;
	/** Steam app id, for matching the game in IGDB */
	steamAppId?: string;
}

/** A game as one Title, however many Platforms it was played on. */
export interface GameTitle {
	/** The cleaned name reduced to its matching form */
	id: string;
	name: string;
	/** The Platform it was most recently played on */
	platform: Platform;
	lastPlayedAt?: string;
	/** Summed over every Platform that reports play time */
	minutesPlayed?: number;
	imageUrl?: string;
	steamAppId?: string;
}

/** A game Title with what the Catalog and the poster pipeline added. */
export interface Game extends GameTitle {
	/** The Catalog description (IGDB summary) */
	description?: string;
	/** The Catalog's public rating, converted to five stars */
	publicRating?: number;
	/** Source URL of the artwork with a stored Spotlight poster */
	posterUrl?: string;
	/** Source URL of the artwork with a stored thumbnail */
	thumbnailUrl?: string;
}

export interface GamingData {
	/** Most recently played first */
	games: Game[];
	errors: string[];
	fetchedAt: string;
}
