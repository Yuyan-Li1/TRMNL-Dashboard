// Centralized configuration - edit these values for your setup

export const LOCATION = {
	// Sydney coordinates (change for your city)
	latitude: -33.8688,
	longitude: 151.2093,
	timezone: "Australia/Sydney",
	locale: "en-AU",
} as const;

export const COMMUTE = {
	origin: { stopId: "10101331", name: "Lidcombe" },
	destination: { stopId: "10101109", name: "Bondi Junction" },
	via: { stopId: "10101101", name: "Town Hall" },
} as const;

export const TRMNL = {
	width: 800,
	height: 480,
	refreshIntervalMinutes: 30,
	bufferMinutes: 30, // How early to show upcoming content
} as const;
