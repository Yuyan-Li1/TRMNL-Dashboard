import https from "node:https";
import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import { LOCATION } from "@/lib/config";
import type {
	CurrentWeather,
	DailyForecast,
	HourlyForecast,
	WeatherData,
} from "@/types/weather";

// Open-Meteo API base URL (no auth required!)
const BASE_URL = "https://api.open-meteo.com/v1/forecast";

/** Fetch JSON via Node https module with IPv4 forced (works around undici connect timeout) */
function httpsGetJson<T>(url: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url);
		const options = {
			hostname: parsedUrl.hostname,
			path: parsedUrl.pathname + parsedUrl.search,
			family: 4,
		};
		https
			.get(options, (res) => {
				let data = "";
				res.on("data", (chunk: string) => {
					data += chunk;
				});
				res.on("end", () => {
					try {
						resolve(JSON.parse(data) as T);
					} catch {
						reject(new Error(`Invalid JSON from ${parsedUrl.hostname}`));
					}
				});
			})
			.on("error", reject);
	});
}

interface OpenMeteoResponse {
	current: {
		time: string;
		temperature_2m: number;
		apparent_temperature: number;
		relative_humidity_2m: number;
		precipitation: number;
		weather_code: number;
		wind_speed_10m: number;
		is_day: number;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		precipitation: number[];
		precipitation_probability: number[];
		weather_code: number[];
	};
	daily: {
		time: string[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_sum: number[];
		precipitation_probability_max: number[];
		weather_code: number[];
		sunrise: string[];
		sunset: string[];
	};
}

/**
 * Fetch weather data from Open-Meteo API
 * Rate limit: 10,000 requests/day (no auth required)
 */
async function fetchWeatherFromAPI(): Promise<WeatherData> {
	const params = new URLSearchParams({
		latitude: LOCATION.latitude.toString(),
		longitude: LOCATION.longitude.toString(),
		timezone: LOCATION.timezone,
		current: [
			"temperature_2m",
			"apparent_temperature",
			"relative_humidity_2m",
			"precipitation",
			"weather_code",
			"wind_speed_10m",
			"is_day",
		].join(","),
		hourly: [
			"temperature_2m",
			"precipitation",
			"precipitation_probability",
			"weather_code",
		].join(","),
		forecast_hours: "24",
		daily: [
			"temperature_2m_max",
			"temperature_2m_min",
			"precipitation_sum",
			"precipitation_probability_max",
			"weather_code",
			"sunrise",
			"sunset",
		].join(","),
	});

	const data = await httpsGetJson<OpenMeteoResponse>(`${BASE_URL}?${params}`);

	const current: CurrentWeather = {
		temperature: Math.round(data.current.temperature_2m),
		apparentTemperature: Math.round(data.current.apparent_temperature),
		humidity: data.current.relative_humidity_2m,
		precipitation: data.current.precipitation,
		weatherCode: data.current.weather_code,
		windSpeed: Math.round(data.current.wind_speed_10m),
		isDay: data.current.is_day === 1,
	};

	const hourly: HourlyForecast[] = data.hourly.time.map((time, i) => ({
		time,
		temperature: Math.round(data.hourly.temperature_2m[i]),
		precipitation: data.hourly.precipitation[i],
		precipitationProbability: data.hourly.precipitation_probability[i],
		weatherCode: data.hourly.weather_code[i],
	}));

	const daily: DailyForecast[] = data.daily.time.map((date, i) => ({
		date,
		temperatureMax: Math.round(data.daily.temperature_2m_max[i]),
		temperatureMin: Math.round(data.daily.temperature_2m_min[i]),
		precipitationSum: data.daily.precipitation_sum[i],
		precipitationProbability: data.daily.precipitation_probability_max[i],
		weatherCode: data.daily.weather_code[i],
		sunrise: data.daily.sunrise[i],
		sunset: data.daily.sunset[i],
	}));

	return {
		current,
		hourly,
		daily,
		fetchedAt: new Date().toISOString(),
	};
}

/**
 * Get weather data (with caching)
 */
export async function getWeather(): Promise<WeatherData> {
	const cached = await cacheGet<WeatherData>(CACHE_KEYS.WEATHER);
	if (cached) {
		return cached;
	}

	const data = await fetchWeatherFromAPI();
	await cacheSet(CACHE_KEYS.WEATHER, data, CACHE_TTL.WEATHER);
	return data;
}

/**
 * Check if rain is expected in the next few hours
 */
export function isRainExpected(weather: WeatherData, hoursAhead = 3): boolean {
	const upcoming = weather.hourly.slice(0, hoursAhead);
	return upcoming.some(
		(h) => h.precipitationProbability > 30 || h.precipitation > 0,
	);
}

/**
 * Get umbrella recommendation based on weather
 */
export function shouldBringUmbrella(weather: WeatherData): boolean {
	const today = weather.daily[0];
	if (today.precipitationProbability > 40 || today.precipitationSum > 1) {
		return true;
	}

	const next12Hours = weather.hourly.slice(0, 12);
	return next12Hours.some((h) => h.precipitationProbability > 50);
}
