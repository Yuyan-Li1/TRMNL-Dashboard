// Centralized configuration - edit these values for your setup

export const LOCATION = {
	// Sydney coordinates (change for your city)
	latitude: -33.8688,
	longitude: 151.2093,
	timezone: "Australia/Sydney",
	locale: "en-AU",
} as const;

export const STATION = {
	// Lidcombe station (change for your commute station)
	stopId: "10101331", // Departure Monitor stop ID
	name: "Lidcombe",
} as const;

export const TRMNL = {
	width: 800,
	height: 480,
	refreshIntervalMinutes: 30,
	bufferMinutes: 30, // How early to show upcoming content
} as const;
