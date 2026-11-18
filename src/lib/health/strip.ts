import { formatMoment, type SentAlert } from "@/lib/alerts/alerts";
import { OWNER_TIME_ZONE } from "@/lib/config";
import { readLastSend } from "./alert";
import { SOURCE_IDS, SOURCES } from "./sources";
import { isStale, type RefreshStatus, readRefreshStatus } from "./status";

/**
 * What the status strip shows: times and source names only. It is public,
 * so no error text and nothing about tokens.
 */
export interface StatusStripView {
	sources: { name: string; lastGoodRead: string; stale: boolean }[];
	lastRefresh: string;
	lastAlert: { label: string; at: string; sent: boolean } | null;
}

function when(at: string | undefined): string {
	return at ? formatMoment(at, OWNER_TIME_ZONE) : "never";
}

export function statusStripView(
	status: RefreshStatus | null,
	lastSend: SentAlert | null,
	now: Date,
): StatusStripView {
	return {
		sources: SOURCE_IDS.map((id) => {
			const health = status?.sources[id];
			return {
				name: SOURCES[id].name,
				lastGoodRead: when(health?.lastGoodReadAt),
				stale: isStale(id, health, now),
			};
		}),
		lastRefresh: when(status?.lastSuccessAt),
		lastAlert: lastSend
			? { label: lastSend.label, at: when(lastSend.at), sent: lastSend.ok }
			: null,
	};
}

/** Read the status strip from Redis. */
export async function loadStatusStrip(): Promise<StatusStripView> {
	const [status, lastSend] = await Promise.all([
		readRefreshStatus(),
		readLastSend(),
	]);
	return statusStripView(status, lastSend, new Date());
}
