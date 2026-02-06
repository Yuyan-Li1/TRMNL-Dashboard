import type { GamingData, RecentGame } from "@/types/gaming";
import { getPlayStationData } from "./playstation";
import { getSteamData } from "./steam";
import { getXboxData } from "./xbox";

/**
 * Fetch gaming data from all platforms
 */
export async function getGamingData(): Promise<GamingData> {
	const errors: string[] = [];

	// Fetch from all platforms in parallel
	const results = await Promise.allSettled([
		getSteamData(),
		getXboxData(),
		getPlayStationData(),
	]);

	const steam = results[0].status === "fulfilled" ? results[0].value : null;
	const xbox = results[1].status === "fulfilled" ? results[1].value : null;
	const playstation =
		results[2].status === "fulfilled" ? results[2].value : null;

	// Collect errors
	if (results[0].status === "rejected") {
		errors.push(`Steam: ${results[0].reason}`);
	}
	if (results[1].status === "rejected") {
		errors.push(`Xbox: ${results[1].reason}`);
	}
	if (results[2].status === "rejected") {
		errors.push(`PlayStation: ${results[2].reason}`);
	}

	// Combine all recent games, deduplicate cross-platform titles,
	// then sort by last played
	const combined: RecentGame[] = [
		...(steam?.recentGames || []),
		...(xbox?.recentGames || []),
		...(playstation?.recentGames || []),
	];

	// Deduplicate by normalized title — merge best data from each platform
	const byTitle = new Map<string, RecentGame>();
	for (const game of combined) {
		const key = game.title.toLowerCase().replace(/[®™©]/g, "").trim();
		const existing = byTitle.get(key);
		if (!existing) {
			byTitle.set(key, game);
			continue;
		}
		// Merge: keep the richer entry but fill in missing fields from the other
		const score = (g: RecentGame) =>
			(g.playtimeRecent ? 4 : 0) +
			(g.playtimeTotal ? 2 : 0) +
			(g.achievementsTotal && g.achievementsTotal > 0 ? 1 : 0);
		const winner = score(game) > score(existing) ? game : existing;
		const loser = winner === game ? existing : game;
		// Use the most recent lastPlayed from either
		if (
			loser.lastPlayed &&
			(!winner.lastPlayed || loser.lastPlayed > winner.lastPlayed)
		) {
			winner.lastPlayed = loser.lastPlayed;
		}
		// Fill in missing playtime/achievements from the other
		winner.playtimeRecent = winner.playtimeRecent ?? loser.playtimeRecent;
		winner.playtimeTotal = winner.playtimeTotal ?? loser.playtimeTotal;
		winner.achievementsEarned =
			winner.achievementsEarned ?? loser.achievementsEarned;
		winner.achievementsTotal =
			winner.achievementsTotal ?? loser.achievementsTotal;
		byTitle.set(key, winner);
	}

	const allRecentGames: RecentGame[] = [...byTitle.values()].sort((a, b) => {
		const dateA = a.lastPlayed ? new Date(a.lastPlayed).getTime() : 0;
		const dateB = b.lastPlayed ? new Date(b.lastPlayed).getTime() : 0;
		return dateB - dateA;
	});

	return {
		steam,
		xbox,
		playstation,
		allRecentGames,
		errors,
		fetchedAt: new Date().toISOString(),
	};
}

/**
 * Get top N recently played games across all platforms
 */
export async function getTopRecentGames(count = 5): Promise<RecentGame[]> {
	const data = await getGamingData();
	return data.allRecentGames.slice(0, count);
}

/**
 * Format playtime for display
 */
export function formatPlaytime(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	if (remainingMinutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get platform display name
 */
export function getPlatformName(platform: RecentGame["platform"]): string {
	switch (platform) {
		case "steam":
			return "Steam";
		case "xbox":
			return "Xbox";
		case "playstation":
			return "PlayStation";
		default:
			return platform;
	}
}

/**
 * Get platform icon name (for e-ink icons)
 */
export function getPlatformIcon(platform: RecentGame["platform"]): string {
	switch (platform) {
		case "steam":
			return "steam";
		case "xbox":
			return "xbox";
		case "playstation":
			return "playstation";
		default:
			return "gamepad";
	}
}
