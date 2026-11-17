// PROTOTYPE, throwaway. Sample scenes for the Spotlight screen prototype.
// Titles and artwork are real; activity, friends and review text are made up.

export type Medium = "game" | "movie" | "show" | "book";
export type Mode = "In progress" | "Finished" | "Friend activity" | "Recommendation";

export interface Rating {
	whose: string; // "You", a friend's name, or a Catalog name
	stars: number; // 0-5 in halves, used by the star and block drawings
	native: string; // the rating as its source states it
}

export interface Scene {
	name: string;
	mode: Mode;
	medium: Medium;
	art: string;
	title: string;
	byline: string;
	lead: string; // sentence-style lead-in used by variant C
	facts: string[];
	progress?: number; // 0-1
	rating?: Rating;
	reason?: string;
	text?: string;
}

export const SCENES: Scene[] = [
	{
		name: "In progress, game",
		mode: "In progress",
		medium: "game",
		art: "silksong",
		title: "Hollow Knight: Silksong",
		byline: "Steam",
		lead: "You're playing",
		facts: ["Played 3 hours ago", "42 hours in total"],
	},
	{
		name: "In progress, show (caught up)",
		mode: "In progress",
		medium: "show",
		art: "pluribus",
		title: "Pluribus",
		byline: "Season 1",
		lead: "You're watching",
		facts: ["Caught up at episode 7 of 9", "Next episode Friday"],
		progress: 7 / 9,
	},
	{
		name: "In progress, book",
		mode: "In progress",
		medium: "book",
		art: "project-hail-mary",
		title: "Project Hail Mary",
		byline: "Andy Weir",
		lead: "You're reading",
		facts: ["Page 212 of 476", "Updated yesterday"],
		progress: 212 / 476,
	},
	{
		name: "Finished, movie",
		mode: "Finished",
		medium: "movie",
		art: "sinners",
		title: "Sinners",
		byline: "2025, Ryan Coogler",
		lead: "You watched",
		facts: ["Watched Saturday 14 November"],
		rating: { whose: "You", stars: 4.5, native: "4.5 / 5" },
	},
	{
		name: "Finished, show",
		mode: "Finished",
		medium: "show",
		art: "severance",
		title: "Severance",
		byline: "Season 2",
		lead: "You finished",
		facts: ["Season 2 finished, 10 episodes", "Last episode watched Sunday"],
	},
	{
		name: "Finished, book",
		mode: "Finished",
		medium: "book",
		art: "piranesi",
		title: "Piranesi",
		byline: "Susanna Clarke",
		lead: "You finished",
		facts: ["Marked as read 12 November"],
		rating: { whose: "You", stars: 5, native: "5 / 5" },
	},
	{
		name: "Friend activity, rating and review",
		mode: "Friend activity",
		medium: "movie",
		art: "perfect-days",
		title: "Perfect Days",
		byline: "2023, Wim Wenders",
		lead: "Mina watched",
		facts: ["Mina, 2 days ago", "You watched it in March"],
		rating: { whose: "Mina", stars: 4.5, native: "4.5 / 5" },
		text: "Two hours of a man cleaning toilets and I did not want it to end. Every morning he looks up at the sky like it is the first one he has seen. I went home and tidied my flat, then sat by the window for an hour doing nothing at all, which is the highest praise I can give a film.",
	},
	{
		name: "Friend activity, rating only (spoiler hidden)",
		mode: "Friend activity",
		medium: "movie",
		art: "dune-2",
		title: "Dune: Part Two",
		byline: "2024, Denis Villeneuve",
		lead: "Jordan watched",
		facts: ["Jordan, yesterday", "Review hidden: it contains spoilers"],
		rating: { whose: "Jordan", stars: 3, native: "3 / 5" },
	},
	{
		name: "Recommendation, Catalog pick",
		mode: "Recommendation",
		medium: "show",
		art: "the-bear",
		title: "The Bear",
		byline: "2022, 4 seasons",
		lead: "Try next",
		facts: [],
		rating: { whose: "TMDB", stars: 4, native: "8.2 / 10" },
		reason: "Because you watched Severance",
		text: "A young chef from the fine dining world returns to Chicago to run his family's sandwich shop after a death in the family, and fights to change it.",
	},
	{
		name: "Recommendation, LLM pick",
		mode: "Recommendation",
		medium: "game",
		art: "hades-2",
		title: "Hades II",
		byline: "2025, Supergiant Games",
		lead: "Try next",
		facts: [],
		rating: { whose: "IGDB", stars: 4.5, native: "92 / 100" },
		reason: "Tight runs with no runback; deeper builds than the first, though the surface route drags a little",
		text: "Battle beyond the Underworld using dark sorcery to take on the Titan of Time in this sequel to the award-winning rogue-like dungeon crawler.",
	},
];

export interface Latest {
	medium: Medium;
	art: string;
	title: string;
	detail: string;
	when: string;
	stars?: number;
}

// The latest activity per medium, shown on the Medium cards.
export const LATEST: Latest[] = [
	{ medium: "game", art: "silksong", title: "Hollow Knight: Silksong", detail: "42 hours", when: "3 hours ago" },
	{ medium: "movie", art: "sinners", title: "Sinners", detail: "Watched", when: "Saturday", stars: 4.5 },
	{ medium: "show", art: "pluribus", title: "Pluribus", detail: "Episode 7, caught up", when: "Friday" },
	{ medium: "book", art: "project-hail-mary", title: "Project Hail Mary", detail: "Page 212 of 476", when: "Yesterday" },
];

export const MEDIUM_LABEL: Record<Medium, string> = {
	game: "Game",
	movie: "Movie",
	show: "Show",
	book: "Book",
};
