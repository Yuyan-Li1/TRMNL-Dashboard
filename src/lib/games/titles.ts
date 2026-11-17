import { DAY_MS } from "@/lib/time";
import {
	type GameTitle,
	IN_PROGRESS_DAYS,
	type PlatformPlay,
} from "@/types/gaming";

const ROMAN_NUMERAL = /^[IVXLCDM]+$/;

function fixAllCaps(name: string): string {
	const letters = name.replace(/[^\p{L}]/gu, "");
	const isAllCaps = letters.length > 0 && letters === letters.toUpperCase();
	// A short all-caps name is more likely an acronym than shouting
	const hasLongWord = name.split(/\s+/).some((word) => {
		const wordLetters = word.replace(/[^\p{L}]/gu, "");
		return wordLetters.length >= 4 && !ROMAN_NUMERAL.test(wordLetters);
	});
	if (!isAllCaps || !hasLongWord) {
		return name;
	}

	return name
		.split(/(\s+)/)
		.map((word) => {
			if (ROMAN_NUMERAL.test(word.replace(/[^\p{L}]/gu, ""))) {
				return word;
			}
			return word
				.toLowerCase()
				.replace(/\p{L}/u, (first) => first.toUpperCase());
		})
		.join("");
}

/**
 * Clean a game's name for matching and display: drop Platform wording,
 * trademark symbols, and fix all-caps names.
 */
export function cleanGameName(name: string): string {
	const cleaned = name
		.replace(/[®™©]/g, "")
		.replace(/\s*[–—-]\s*Nintendo Switch 2 Edition.*$/i, "")
		.replace(/\s+for Nintendo Switch\b/i, "")
		.replace(/\s+/g, " ")
		.trim();
	return fixAllCaps(cleaned);
}

/** The form of a cleaned name that two Platforms' spellings agree on. */
export function matchKey(cleanedName: string): string {
	return cleanedName
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, "");
}

function playedAt(play: { lastPlayedAt?: string }): number {
	return play.lastPlayedAt ? new Date(play.lastPlayedAt).getTime() : 0;
}

/** A game is In progress when it was played in the last 14 days. */
export function isInProgress(
	title: { lastPlayedAt?: string },
	now: Date,
): boolean {
	return (
		title.lastPlayedAt !== undefined &&
		now.getTime() - new Date(title.lastPlayedAt).getTime() <=
			IN_PROGRESS_DAYS * DAY_MS
	);
}

/**
 * Merge every source's plays into one Title per game. A game played on
 * several Platforms shows the Platform it was most recently played on, with
 * its play time summed. Titles come back most recently played first.
 */
export function mergePlays(plays: PlatformPlay[]): GameTitle[] {
	const groups = new Map<string, PlatformPlay[]>();
	for (const play of plays) {
		const key = matchKey(cleanGameName(play.name));
		if (!key) continue;
		groups.set(key, [...(groups.get(key) ?? []), play]);
	}

	const titles: GameTitle[] = [...groups].map(([id, group]) => {
		const byRecency = group.toSorted((a, b) => playedAt(b) - playedAt(a));
		const latest = byRecency[0];
		const timed = group.filter((play) => play.minutesPlayed !== undefined);

		return {
			id,
			name: cleanGameName(latest.name),
			platform: latest.platform,
			lastPlayedAt: latest.lastPlayedAt,
			minutesPlayed:
				timed.length > 0
					? timed.reduce((sum, play) => sum + (play.minutesPlayed ?? 0), 0)
					: undefined,
			imageUrl: byRecency.find((play) => play.imageUrl)?.imageUrl,
			steamAppId: group.find((play) => play.steamAppId)?.steamAppId,
		};
	});

	return titles.toSorted((a, b) => playedAt(b) - playedAt(a));
}
