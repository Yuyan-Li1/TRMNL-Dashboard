import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { STATION } from "@/lib/config";
import type { StopDeparture, TransitData } from "@/types/transport";

const TFNSW_API_KEY = process.env.TFNSW_API_KEY;

// Transport NSW Departure Monitor endpoint (returns JSON, no protobuf needed)
const DEPARTURE_MONITOR_URL =
	"https://api.transport.nsw.gov.au/v1/tp/departure_mon";

interface DepartureMonitorResponse {
	stopEvents?: DepartureStopEvent[];
}

interface DepartureStopEvent {
	departureTimePlanned: string;
	departureTimeEstimated?: string;
	isCancelled?: boolean;
	transportation: {
		number: string; // e.g., "T1"
		name?: string;
		destination: {
			name: string; // e.g., "City via Central"
		};
		product?: {
			class?: number;
			name?: string; // e.g., "Sydney Trains"
		};
	};
	location: {
		disassembledName?: string; // Platform name, e.g., "Platform 1"
		id?: string;
	};
}

function getDelayStatus(
	delaySeconds: number,
	isCancelled?: boolean,
): StopDeparture["status"] {
	if (isCancelled) return "cancelled";
	if (delaySeconds <= -60) return "early";
	if (delaySeconds >= 300) return "delayed"; // 5+ minutes late
	return "on_time";
}

/**
 * Format delay for display
 */
export function formatDelay(delaySeconds: number): string {
	if (Math.abs(delaySeconds) < 60) return "On time";
	const minutes = Math.round(delaySeconds / 60);
	if (minutes > 0) return `${minutes} min late`;
	return `${Math.abs(minutes)} min early`;
}

/**
 * Fetch departures from the Transport NSW Departure Monitor API
 * Rate limit: 60,000 requests/day
 */
async function fetchDepartures(
	stopId: string,
	limit = 5,
): Promise<StopDeparture[]> {
	if (!TFNSW_API_KEY) {
		throw new Error("TFNSW_API_KEY not configured");
	}

	const params = new URLSearchParams({
		outputFormat: "rapidJSON",
		coordOutputFormat: "EPSG:4326",
		mode: "direct",
		type_dm: "stop",
		name_dm: stopId,
		departureMonitorMacro: "true",
		TfNSWDM: "true",
		version: "10.2.1.42",
	});

	const response = await fetch(`${DEPARTURE_MONITOR_URL}?${params}`, {
		headers: {
			Authorization: `apikey ${TFNSW_API_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error(`TfNSW Departure Monitor API error: ${response.status}`);
	}

	const data: DepartureMonitorResponse = await response.json();
	const stopEvents = data.stopEvents || [];
	const departures: StopDeparture[] = [];

	for (const event of stopEvents) {
		const plannedTime = new Date(event.departureTimePlanned);
		const estimatedTime = event.departureTimeEstimated
			? new Date(event.departureTimeEstimated)
			: undefined;

		const delaySeconds = estimatedTime
			? Math.round((estimatedTime.getTime() - plannedTime.getTime()) / 1000)
			: 0;

		departures.push({
			tripId: `${event.transportation.number}-${event.departureTimePlanned}`,
			routeId: event.transportation.number,
			routeShortName: event.transportation.number,
			transportType: event.transportation.product?.name || "Train",
			headsign: event.transportation.destination.name,
			scheduledTime: plannedTime.toISOString(),
			estimatedTime: estimatedTime?.toISOString(),
			delaySeconds,
			platform: event.location.disassembledName,
			status: getDelayStatus(delaySeconds, event.isCancelled),
		});
	}

	return departures
		.sort((a, b) => {
			const timeA = new Date(a.estimatedTime || a.scheduledTime).getTime();
			const timeB = new Date(b.estimatedTime || b.scheduledTime).getTime();
			return timeA - timeB;
		})
		.slice(0, limit);
}

/**
 * Get transit data with caching
 */
export async function getTransitDepartures(
	stopId: string = STATION.stopId,
): Promise<TransitData> {
	const cacheKey = `${CACHE_KEYS.TRANSIT}:${stopId}`;

	const cached = await cacheGet<TransitData>(cacheKey);
	if (cached) {
		return cached;
	}

	const departures = await fetchDepartures(stopId);

	const data: TransitData = {
		stationName: STATION.name,
		stationId: stopId,
		departures,
		fetchedAt: new Date().toISOString(),
	};

	await cacheSet(cacheKey, data, CACHE_TTL.TRANSIT);
	return data;
}

/**
 * Check if any trains are significantly delayed
 */
export function hasSignificantDelays(transit: TransitData): boolean {
	return transit.departures.some((d) => d.delaySeconds >= 600); // 10+ minutes
}

/**
 * Get the next train to a specific destination
 */
export function getNextTrainTo(
	transit: TransitData,
	destinationPattern: string,
): StopDeparture | null {
	return (
		transit.departures.find((d) =>
			d.headsign.toLowerCase().includes(destinationPattern.toLowerCase()),
		) || null
	);
}
