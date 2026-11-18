import { writeFullHistories } from "./histories";

export interface DailyResult {
	errors: string[];
	ranAt: string;
}

/**
 * The daily run, separate from the 15-minute refresh: write each source's
 * full history for the Collector's consumed set. Called by `POST /api/daily`.
 */
export async function runDaily(): Promise<DailyResult> {
	const errors = await writeFullHistories();
	return { errors, ranAt: new Date().toISOString() };
}
