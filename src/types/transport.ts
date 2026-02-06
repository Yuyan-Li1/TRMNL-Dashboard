export interface CommuteLeg {
	line: string; // "T2", "T4"
	lineName: string; // "Inner West & Leppington"
	origin: string; // "Lidcombe"
	destination: string; // "Town Hall"
	departPlanned: string; // ISO timestamp
	departEstimated?: string;
	arrivePlanned: string;
	arriveEstimated?: string;
	delaySeconds: number;
	status: "on_time" | "delayed" | "early" | "cancelled";
	platform?: string;
}

export interface CommuteJourney {
	legs: CommuteLeg[];
	totalDurationMinutes: number;
	departureTime: string; // first leg depart
	arrivalTime: string; // last leg arrive
	status: "on_time" | "delayed" | "cancelled";
	delayMinutes: number; // worst delay across legs
}

export interface TransitData {
	origin: string;
	destination: string;
	direction: "to_work" | "to_home";
	journeys: CommuteJourney[];
	fetchedAt: string;
}

// Sydney Trains line colors (for reference)
export const TRAIN_LINES: Record<string, { name: string; color: string }> = {
	T1: { name: "North Shore & Western", color: "#F99D1C" },
	T2: { name: "Inner West & Leppington", color: "#0098CD" },
	T3: { name: "Bankstown", color: "#F37021" },
	T4: { name: "Eastern Suburbs & Illawarra", color: "#005AA3" },
	T5: { name: "Cumberland", color: "#C4258F" },
	T7: { name: "Olympic Park", color: "#6F818E" },
	T8: { name: "Airport & South", color: "#00954C" },
	T9: { name: "Northern", color: "#D11F2F" },
};
