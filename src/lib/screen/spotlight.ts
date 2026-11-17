import type { Mode, SpotlightCandidate } from "./types";

/** How often each Mode takes the Spotlight, out of 100. */
export const MODE_SHARES: Record<Mode, number> = {
	"In progress": 35,
	Finished: 25,
	"Friend activity": 20,
	Recommendation: 20,
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface PickSpotlightInput {
	/** Titles inside their eligibility window, each with artwork */
	eligible: SpotlightCandidate[];
	/** Every Title with artwork, used only when nothing is eligible */
	fallback: SpotlightCandidate[];
	/** The id of the previous pick */
	previousId?: string;
	now: Date;
	/** Returns a number in [0, 1); injectable for tests */
	random?: () => number;
}

function weightedPick<T>(
	items: T[],
	weightOf: (item: T) => number,
	random: () => number,
): T {
	const total = items.reduce((sum, item) => sum + weightOf(item), 0);
	let remaining = random() * total;
	for (const item of items) {
		remaining -= weightOf(item);
		if (remaining < 0) {
			return item;
		}
	}
	return items[items.length - 1];
}

function activityTime(candidate: SpotlightCandidate): number {
	return new Date(candidate.activityAt).getTime();
}

/**
 * Pick the Title for the Spotlight. A Mode is chosen by its share, with the
 * Modes that have nothing eligible skipped; within the Mode, fresher
 * activity is favoured. The previous pick is not repeated unless it is the
 * only Title eligible. With nothing eligible at all, the Spotlight is the
 * most recently active Title that has artwork.
 */
export function pickSpotlight({
	eligible,
	fallback,
	previousId,
	now,
	random = Math.random,
}: PickSpotlightInput): SpotlightCandidate | null {
	if (eligible.length === 0) {
		return (
			fallback.toSorted((a, b) => activityTime(b) - activityTime(a))[0] ?? null
		);
	}

	const others = eligible.filter((candidate) => candidate.id !== previousId);
	const pool = others.length > 0 ? others : eligible;

	const modes = [...new Set(pool.map((candidate) => candidate.mode))];
	const mode = weightedPick(modes, (each) => MODE_SHARES[each], random);

	return weightedPick(
		pool.filter((candidate) => candidate.mode === mode),
		(candidate) => {
			const days =
				Math.max(0, now.getTime() - activityTime(candidate)) / DAY_MS;
			return 1 / (1 + days);
		},
		random,
	);
}
