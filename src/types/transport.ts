export interface StopDeparture {
	tripId: string;
	routeId: string;
	routeShortName: string; // e.g., "T1", "T2"
	transportType: string; // e.g., "Train", "Bus"
	headsign: string; // e.g., "City via Central"
	scheduledTime: string; // ISO timestamp
	estimatedTime?: string; // ISO timestamp if realtime available
	delaySeconds: number; // Positive = late, negative = early
	platform?: string;
	status: "on_time" | "delayed" | "early" | "cancelled";
}

export interface TransitData {
	stationName: string;
	stationId: string;
	departures: StopDeparture[];
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
