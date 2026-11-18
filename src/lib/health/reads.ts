import { AsyncLocalStorage } from "node:async_hooks";
import type { SourceId } from "./sources";
import type { RunReads } from "./status";

/** A source turned its token away: the owner must replace it. */
export class TokenRejectedError extends Error {
	override name = "TokenRejectedError";
}

const currentRun = new AsyncLocalStorage<RunReads>();

/**
 * Run a refresh, collecting what `trackRead` sees of each source inside it.
 */
export async function collectReads<T>(
	run: () => Promise<T>,
): Promise<{ result: T; reads: RunReads }> {
	const reads: RunReads = {};
	const result = await currentRun.run(reads, run);
	return { result, reads };
}

/**
 * Make a real read of a source (not an answer from our own cache), noting
 * for the run in progress whether it worked. Outside a run it only reads.
 */
export async function trackRead<T>(
	source: SourceId,
	read: () => Promise<T>,
): Promise<T> {
	const reads = currentRun.getStore();
	const entry = reads && (reads[source] ??= { good: 0, failed: 0 });
	try {
		const value = await read();
		if (entry) {
			entry.good += 1;
		}
		return value;
	} catch (error) {
		if (entry) {
			entry.failed += 1;
			entry.error = String(error);
			if (error instanceof TokenRejectedError) {
				entry.rejected = true;
			}
		}
		throw error;
	}
}
