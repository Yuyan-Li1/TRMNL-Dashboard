import { AlertBanner } from "@/components/widgets";
import { LOCATION } from "@/lib/config";
import { calculateLayout, getSlotStyle } from "@/lib/dashboard/layout";
import type { DashboardRenderData } from "@/lib/dashboard/loader";
import { renderWidgets } from "@/lib/dashboard/widget-renderer";

interface DashboardScreenProps {
	data: DashboardRenderData;
	footerLabel?: string;
}

export function DashboardScreen({
	data,
	footerLabel = "TRMNL Dashboard",
}: DashboardScreenProps) {
	const {
		context,
		widgets,
		routine,
		medications,
		data: widgetData,
		meta,
	} = data;
	const layout = calculateLayout(widgets);
	const renderedWidgets = renderWidgets(
		widgets,
		widgetData,
		routine,
		medications,
	);
	const now = new Date();
	const tz = LOCATION.timezone;

	return (
		<div className="relative">
			<div className="trmnl-container flex flex-col bg-eink-white">
				{context.specialConditions.length > 0 && (
					<AlertBanner conditions={context.specialConditions} />
				)}

				<header className="flex items-center justify-between px-3 py-2 border-b-2 border-eink-black">
					<div className="flex items-center gap-4">
						<time className="text-eink-2xl font-bold">
							{now.toLocaleTimeString(LOCATION.locale, {
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
								timeZone: tz,
							})}
						</time>
						<span className="text-eink-base text-eink-dark">
							{now.toLocaleDateString(LOCATION.locale, {
								weekday: "long",
								day: "numeric",
								month: "short",
								timeZone: tz,
							})}
						</span>
					</div>

					<div className="flex items-center gap-2 text-eink-xs text-eink-dark">
						<span className="uppercase">{context.dayType}</span>
						<span>|</span>
						<span className="uppercase">{context.timeBlock}</span>
						{meta.dataAge && (
							<>
								<span>|</span>
								<span>{meta.dataAge}</span>
							</>
						)}
					</div>
				</header>

				<main
					className="flex-1 p-2 grid gap-2"
					style={{
						gridTemplateColumns: "repeat(2, 1fr)",
						gridTemplateRows: "repeat(2, 1fr)",
					}}
				>
					{renderedWidgets.map((widget, index) => {
						const widgetConfig = widgets[index];
						const slot = widgetConfig ? layout.get(widgetConfig) : undefined;

						return (
							<div
								key={
									widgetConfig
										? `${widgetConfig.type}-${widgetConfig.priority}`
										: `widget-${index}`
								}
								style={slot ? getSlotStyle(slot) : undefined}
							>
								{widget}
							</div>
						);
					})}

					{renderedWidgets.length === 0 && (
						<div className="col-span-2 row-span-2 flex items-center justify-center text-eink-dark">
							<div className="text-center">
								<p className="text-eink-lg mb-2">No widgets configured</p>
								<p className="text-eink-sm">Check schedule settings</p>
							</div>
						</div>
					)}
				</main>

				<footer className="px-3 py-1 border-t border-eink-light flex justify-between text-eink-xs text-eink-dark">
					<span>{footerLabel}</span>
					<span>
						Updated{" "}
						{new Date(meta.renderedAt).toLocaleTimeString(LOCATION.locale, {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false,
							timeZone: tz,
						})}
					</span>
				</footer>
			</div>
			{/* Debug border: shows TRMNL 800x480 right/bottom edge */}
			<div
				className="absolute pointer-events-none border-r-2 border-b-2 border-dashed border-red-400"
				style={{ top: 0, left: 0, width: 800, height: 480 }}
			/>
		</div>
	);
}
