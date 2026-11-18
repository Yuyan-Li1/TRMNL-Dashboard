import { writeFullHistories } from "./histories";
import { type RebuildResult, rebuildCatalogPicks } from "./picks";

export interface DailyResult {
	/** How many Catalog picks each Medium gained */
	picksAdded: RebuildResult["added"];
	errors: string[];
	ranAt: string;
}

/**
 * The daily run, separate from the 15-minute refresh: write each source's
 * full history for the Collector's consumed set, and rebuild the Catalog
 * picks. Called by `POST /api/daily`.
 */
export async function runDaily(): Promise<DailyResult> {
	const [historyErrors, picks] = await Promise.all([
		writeFullHistories(),
		rebuildCatalogPicks().catch((error): RebuildResult => ({
			added: { movie: 0, show: 0, game: 0 },
			errors: [`Picks: ${error}`],
		})),
	]);
	return {
		picksAdded: picks.added,
		errors: [...historyErrors, ...picks.errors],
		ranAt: new Date().toISOString(),
	};
}
