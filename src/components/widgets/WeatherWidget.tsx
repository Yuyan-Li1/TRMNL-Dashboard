import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";
import { shouldBringUmbrella } from "@/lib/api/weather";
import { WEATHER_CODES, type WeatherData } from "@/types/weather";

interface WeatherWidgetProps {
	data: WeatherData | null;
	size?: "small" | "medium" | "large";
	showForecast?: boolean;
}

export function WeatherWidget({
	data,
	size = "medium",
	showForecast = true,
}: WeatherWidgetProps) {
	if (!data) {
		return (
			<EinkCard
				title="Weather"
				icon={<EinkIcon name="cloud" size="sm" />}
				size={size}
			>
				<div className="flex items-center justify-center h-full text-eink-dark">
					No weather data
				</div>
			</EinkCard>
		);
	}

	const { current, daily } = data;
	const weatherInfo = WEATHER_CODES[current.weatherCode] || {
		description: "Unknown",
		icon: "cloud",
	};
	const needsUmbrella = shouldBringUmbrella(data);

	return (
		<EinkCard
			title="Weather"
			icon={<EinkIcon name="sun" size="sm" />}
			size={size}
		>
			<div className="flex flex-col h-full">
				{/* Current conditions */}
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-3">
						<EinkIcon name={weatherInfo.icon} size="xl" />
						<div>
							<div className="text-eink-3xl font-bold">
								{current.temperature}&deg;
							</div>
							<div className="text-eink-sm text-eink-dark">
								Feels {current.apparentTemperature}&deg;
							</div>
						</div>
						<div className="text-eink-base text-eink-dark ml-1">
							{weatherInfo.description}
						</div>
					</div>

					{needsUmbrella && (
						<div className="flex items-center gap-1 text-eink-black">
							<EinkIcon name="umbrella" size="md" />
							<span className="text-eink-sm font-bold">BRING</span>
						</div>
					)}
				</div>

				{/* Today's high/low */}
				{daily[0] && (
					<div className="flex gap-4 text-eink-sm text-eink-dark">
						<span>H: {daily[0].temperatureMax}&deg;</span>
						<span>L: {daily[0].temperatureMin}&deg;</span>
						{daily[0].precipitationProbability > 0 && (
							<span>Rain: {daily[0].precipitationProbability}%</span>
						)}
					</div>
				)}

				{/* 3-day forecast (if space) */}
				{showForecast && size !== "small" && (
					<div className="mt-auto pt-2 border-t-2 border-eink-light">
						<div className="flex justify-between">
							{daily.slice(1, 4).map((day) => (
								<div key={day.date} className="text-center">
									<div className="text-eink-xs text-eink-dark">
										{new Date(day.date).toLocaleDateString("en-AU", {
											weekday: "short",
										})}
									</div>
									<div className="text-eink-sm font-bold">
										{day.temperatureMax}&deg;/{day.temperatureMin}&deg;
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</EinkCard>
	);
}
