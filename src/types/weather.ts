export interface CurrentWeather {
	temperature: number;
	apparentTemperature: number;
	humidity: number;
	precipitation: number;
	weatherCode: number;
	windSpeed: number;
	isDay: boolean;
}

export interface HourlyForecast {
	time: string;
	temperature: number;
	precipitation: number;
	precipitationProbability: number;
	weatherCode: number;
}

export interface DailyForecast {
	date: string;
	temperatureMax: number;
	temperatureMin: number;
	precipitationSum: number;
	precipitationProbability: number;
	weatherCode: number;
	sunrise: string;
	sunset: string;
}

export interface WeatherData {
	current: CurrentWeather;
	hourly: HourlyForecast[];
	daily: DailyForecast[];
	fetchedAt: string;
}

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs
export const WEATHER_CODES: Record<
	number,
	{ description: string; icon: string }
> = {
	0: { description: "Clear sky", icon: "sun" },
	1: { description: "Mainly clear", icon: "sun" },
	2: { description: "Partly cloudy", icon: "cloud" },
	3: { description: "Overcast", icon: "cloud" },
	45: { description: "Fog", icon: "cloud" },
	48: { description: "Depositing rime fog", icon: "cloud" },
	51: { description: "Light drizzle", icon: "cloud-rain" },
	53: { description: "Moderate drizzle", icon: "cloud-rain" },
	55: { description: "Dense drizzle", icon: "cloud-rain" },
	61: { description: "Slight rain", icon: "cloud-rain" },
	63: { description: "Moderate rain", icon: "cloud-rain" },
	65: { description: "Heavy rain", icon: "cloud-rain" },
	71: { description: "Slight snow", icon: "cloud" },
	73: { description: "Moderate snow", icon: "cloud" },
	75: { description: "Heavy snow", icon: "cloud" },
	80: { description: "Slight rain showers", icon: "cloud-rain" },
	81: { description: "Moderate rain showers", icon: "cloud-rain" },
	82: { description: "Violent rain showers", icon: "cloud-rain" },
	95: { description: "Thunderstorm", icon: "alert" },
	96: { description: "Thunderstorm with hail", icon: "alert" },
	99: { description: "Thunderstorm with heavy hail", icon: "alert" },
};
