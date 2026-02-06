// Platform identifiers
export const GAMING_PLATFORMS = ["steam", "xbox", "playstation"] as const;
export type GamingPlatform = (typeof GAMING_PLATFORMS)[number];

// Individual game with playtime info
export interface RecentGame {
	platform: GamingPlatform;
	gameId: string;
	title: string;
	imageUrl?: string;
	lastPlayed?: string; // ISO timestamp
	playtimeRecent?: number; // Minutes played in last 2 weeks
	playtimeTotal?: number; // Total minutes played
	achievementsEarned?: number;
	achievementsTotal?: number;
}

// Platform-specific data
export interface SteamData {
	playerId: string;
	playerName: string;
	avatarUrl?: string;
	recentGames: RecentGame[];
	fetchedAt: string;
}

export interface XboxData {
	gamertag: string;
	gamerScore: number;
	avatarUrl?: string;
	recentGames: RecentGame[];
	fetchedAt: string;
}

export interface PlayStationData {
	onlineId: string;
	accountId: string;
	avatarUrl?: string;
	trophyLevel: number;
	trophyProgress: number;
	recentGames: RecentGame[];
	fetchedAt: string;
}

// Combined gaming data
export interface GamingData {
	steam: SteamData | null;
	xbox: XboxData | null;
	playstation: PlayStationData | null;
	allRecentGames: RecentGame[]; // Combined and sorted
	errors: string[];
	fetchedAt: string;
}

// Trophy/Achievement types
export interface Trophy {
	trophyId: string;
	name: string;
	description?: string;
	type: "platinum" | "gold" | "silver" | "bronze";
	earned: boolean;
	earnedAt?: string;
	rarity?: number; // Percentage of players who earned it
}

export interface Achievement {
	achievementId: string;
	name: string;
	description?: string;
	gamerscore?: number; // Xbox only
	earned: boolean;
	earnedAt?: string;
	rarity?: number;
}
