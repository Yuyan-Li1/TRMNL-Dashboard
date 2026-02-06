import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { COMMUTE, LOCATION } from "@/lib/config";
import { getNow } from "@/lib/utils/date";
import type {
	CommuteJourney,
	CommuteLeg,
	TransitData,
} from "@/types/transport";

const TFNSW_API_KEY = process.env.TFNSW_API_KEY;

// Transport NSW Trip Planner endpoint
const TRIP_PLANNER_URL = "https://api.transport.nsw.gov.au/v1/tp/trip";

// --- TfNSW Trip Planner response types ---

interface TripPlannerResponse {
	journeys?: TripJourney[];
}

interface TripJourney {
	legs: TripLeg[];
}

interface TripLeg {
	origin: TripStop;
	destination: TripStop;
	transportation: {
		number?: string; // "T2", "T4"
		name?: string; // full line name
		product?: {
			class?: number; // 1 = train, 5 = bus, 9 = ferry, 11 = school bus
			name?: string;
		};
		disassembledName?: string;
	};
	duration?: number; // seconds
	isRealtimeControlled?: boolean;
	stopSequence?: TripStopSequence[];
}

interface TripStop {
	name: string;
	departureTimePlanned?: string;
	departureTimeEstimated?: string;
	arrivalTimePlanned?: string;
	arrivalTimeEstimated?: string;
	disassembledName?: string; // platform
	isCancelled?: boolean;
}

interface TripStopSequence {
	arrivalTimePlanned?: string;
	arrivalTimeEstimated?: string;
	departureTimePlanned?: string;
	departureTimeEstimated?: string;
	isCancelled?: boolean;
}

// --- Helpers ---

function getLegStatus(
	delaySeconds: number,
	isCancelled?: boolean,
): CommuteLeg["status"] {
	if (isCancelled) return "cancelled";
	if (delaySeconds <= -60) return "early";
	if (delaySeconds >= 300) return "delayed"; // 5+ minutes late
	return "on_time";
}

function getJourneyStatus(legs: CommuteLeg[]): CommuteJourney["status"] {
	if (legs.some((l) => l.status === "cancelled")) return "cancelled";
	if (legs.some((l) => l.status === "delayed")) return "delayed";
	return "on_time";
}

/**
 * Format delay for display
 */
export function formatDelay(delaySeconds: number): string {
	if (Math.abs(delaySeconds) < 60) return "On time";
	const minutes = Math.round(delaySeconds / 60);
	if (minutes > 0) return `+${minutes}`;
	return `${minutes}`;
}

/**
 * Check if any journeys have significant delays (10+ min) or cancellations
 */
export function hasSignificantDelays(transit: TransitData): boolean {
	return transit.journeys.some(
		(j) => j.delayMinutes >= 10 || j.status === "cancelled",
	);
}

/**
 * Fetch commute journeys from the TfNSW Trip Planner API
 */
async function fetchCommuteJourneys(
	reverse = false,
	limit = 3,
): Promise<CommuteJourney[]> {
	if (!TFNSW_API_KEY) {
		throw new Error("TFNSW_API_KEY not configured");
	}

	const origin = reverse ? COMMUTE.destination : COMMUTE.origin;
	const destination = reverse ? COMMUTE.origin : COMMUTE.destination;

	const now = getNow(LOCATION.timezone);
	const itdDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
	const itdTime = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

	const params = new URLSearchParams({
		outputFormat: "rapidJSON",
		coordOutputFormat: "EPSG:4326",
		depArrMacro: "dep",
		type_origin: "stop",
		name_origin: origin.stopId,
		type_destination: "stop",
		name_destination: destination.stopId,
		itdDate,
		itdTime,
		calcNumberOfTrips: String(limit),
		TfNSWTR: "true",
		version: "10.2.1.42",
	});

	const response = await fetch(`${TRIP_PLANNER_URL}?${params}`, {
		headers: {
			Authorization: `apikey ${TFNSW_API_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error(`TfNSW Trip Planner API error: ${response.status}`);
	}

	const data: TripPlannerResponse = await response.json();
	const rawJourneys = data.journeys || [];

	return rawJourneys.slice(0, limit).map((journey) => {
		const legs = parseLegs(journey.legs);
		const firstLeg = legs[0];
		const lastLeg = legs[legs.length - 1];
		const worstDelay = Math.max(...legs.map((l) => l.delaySeconds));

		const departureTime =
			firstLeg?.departEstimated || firstLeg?.departPlanned || "";
		const arrivalTime =
			lastLeg?.arriveEstimated || lastLeg?.arrivePlanned || "";

		let totalDurationMinutes = 0;
		if (departureTime && arrivalTime) {
			totalDurationMinutes = Math.round(
				(new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) /
					60000,
			);
		}

		return {
			legs,
			totalDurationMinutes,
			departureTime,
			arrivalTime,
			status: getJourneyStatus(legs),
			delayMinutes: Math.max(0, Math.round(worstDelay / 60)),
		};
	});
}

/**
 * Parse TfNSW trip legs into CommuteLeg[], filtering out walking legs
 */
function parseLegs(rawLegs: TripLeg[]): CommuteLeg[] {
	return rawLegs
		.filter((leg) => {
			// Only include train legs (product class 1), skip walking/transfer
			const productClass = leg.transportation.product?.class;
			return productClass === 1;
		})
		.map((leg) => {
			const departPlanned = leg.origin.departureTimePlanned || "";
			const departEstimated = leg.origin.departureTimeEstimated;
			const arrivePlanned = leg.destination.arrivalTimePlanned || "";
			const arriveEstimated = leg.destination.arrivalTimeEstimated;

			const plannedDep = departPlanned ? new Date(departPlanned) : null;
			const estimatedDep = departEstimated ? new Date(departEstimated) : null;
			const delaySeconds =
				plannedDep && estimatedDep
					? Math.round((estimatedDep.getTime() - plannedDep.getTime()) / 1000)
					: 0;

			const isCancelled = leg.origin.isCancelled || leg.destination.isCancelled;

			// Extract short line name (e.g., "T2") from transportation.number or disassembledName
			const line =
				leg.transportation.number || leg.transportation.disassembledName || "";

			// Clean origin/destination names (remove "Station" suffix, platform info)
			const originName = cleanStationName(leg.origin.name);
			const destName = cleanStationName(leg.destination.name);

			return {
				line,
				lineName: leg.transportation.name || line,
				origin: originName,
				destination: destName,
				departPlanned,
				departEstimated: departEstimated || undefined,
				arrivePlanned,
				arriveEstimated: arriveEstimated || undefined,
				delaySeconds,
				status: getLegStatus(delaySeconds, isCancelled),
				platform: leg.origin.disassembledName || undefined,
			};
		});
}

/**
 * Clean station name: "Lidcombe Station, Platform 1" → "Lidcombe"
 */
function cleanStationName(name: string): string {
	return name
		.replace(/\s*Station.*$/i, "")
		.replace(/,.*$/, "")
		.trim();
}

/**
 * Get commute direction based on current Sydney time
 * Morning/workday → to_work, Evening/night → to_home
 */
export function getCommuteDirection(): "to_work" | "to_home" {
	const now = getNow(LOCATION.timezone);
	const hour = now.getHours();
	// Before 2 PM: heading to work. 2 PM and after: heading home.
	return hour < 14 ? "to_work" : "to_home";
}

/**
 * Get commute data with caching
 */
export async function getCommuteJourneys(
	direction?: "to_work" | "to_home",
): Promise<TransitData> {
	const dir = direction ?? getCommuteDirection();
	const reverse = dir === "to_home";

	const cached = await cacheGet<TransitData>(CACHE_KEYS.TRANSIT);
	if (cached && cached.direction === dir) {
		return cached;
	}

	const journeys = await fetchCommuteJourneys(reverse);

	const origin = reverse ? COMMUTE.destination : COMMUTE.origin;
	const destination = reverse ? COMMUTE.origin : COMMUTE.destination;

	const data: TransitData = {
		origin: origin.name,
		destination: destination.name,
		direction: dir,
		journeys,
		fetchedAt: new Date().toISOString(),
	};

	await cacheSet(CACHE_KEYS.TRANSIT, data, CACHE_TTL.TRANSIT);
	return data;
}
