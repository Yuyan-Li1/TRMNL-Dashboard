import { getRedis } from "@/lib/cache/redis";
import { HOME_KEYS, type HomeStatus } from "@/lib/home/status";
import { HOUR_MS } from "@/lib/time";

/**
 * How old the home server's heartbeat may be. The Collector ticks every 15
 * minutes; an hour without one is Stale, and Vercel alerts.
 */
const HEARTBEAT_STALE_AFTER_MS = HOUR_MS;

/** Whether the home server's heartbeat is Stale. */
export function isHeartbeatStale(home: HomeStatus, now: Date): boolean {
	return (
		now.getTime() - new Date(home.heartbeatAt).getTime() >
		HEARTBEAT_STALE_AFTER_MS
	);
}

/** What the Collector last said of itself; null until it has ticked once. */
export async function readHomeStatus(): Promise<HomeStatus | null> {
	return getRedis().get<HomeStatus>(HOME_KEYS.STATUS);
}
