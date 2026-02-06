import { AlertBanner } from "@/components/widgets";
import { LOCATION } from "@/lib/config";
import { calculateLayout, getSlotStyle } from "@/lib/dashboard/layout";
import type { DashboardRenderData } from "@/lib/dashboard/loader";
import {
	getEffectiveWidgets,
	renderWidget,
	renderWidgets,
} from "@/lib/dashboard/widget-renderer";
import { WIDGET_TYPES } from "@/types";

interface DashboardScreenProps {
	data: DashboardRenderData;
}

export function DashboardScreen({ data }: DashboardScreenProps) {
	const {
		context,
		widgets,
		routine,
		medications,
		data: widgetData,
		meta,
	} = data;
	const effectiveWidgets = getEffectiveWidgets(widgets);
	const layout = calculateLayout(effectiveWidgets);
	const renderedWidgets = renderWidgets(
		widgets,
		widgetData,
		routine,
		medications,
	);

	// Only show widgets that got a layout slot (grid is 2x2 = max 4)
	const layoutWidgets = renderedWidgets.filter(({ config }) =>
		layout.has(config),
	);

	// Build inactive widgets (types not shown on the active grid)
	const shownTypes = new Set(layoutWidgets.map(({ config }) => config.type));
	// When medication is merged into the routine cell, mark it as shown
	if (effectiveWidgets.length < widgets.length) {
		shownTypes.add("medication");
	}
	const inactiveWidgets = WIDGET_TYPES.filter((t) => !shownTypes.has(t))
		.map((type) => {
			const display = { type, priority: 0, size: "medium" as const };
			const element = renderWidget(display, widgetData, routine, medications);
			return element ? { type, element } : null;
		})
		.filter(Boolean);
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
					className="flex-1 min-h-0 overflow-hidden p-2 grid gap-2"
					style={{
						gridTemplateColumns: "repeat(2, 1fr)",
						gridTemplateRows: "repeat(2, 1fr)",
					}}
				>
					{layoutWidgets.map(({ config, element }) => {
						const slot = layout.get(config);

						return (
							<div
								key={`${config.type}-${config.priority}`}
								className="overflow-hidden"
								style={slot ? getSlotStyle(slot) : undefined}
							>
								{element}
							</div>
						);
					})}

					{layoutWidgets.length === 0 && (
						<div className="col-span-2 row-span-2 flex items-center justify-center text-eink-dark">
							<div className="text-center">
								<p className="text-eink-lg mb-2">No widgets configured</p>
								<p className="text-eink-sm">Check schedule settings</p>
							</div>
						</div>
					)}
				</main>
			</div>
			{/* Debug border: shows TRMNL 800x480 right/bottom edge */}
			<div
				className="absolute pointer-events-none border-r-2 border-b-2 border-dashed border-red-400"
				style={{ top: 0, left: 0, width: 800, height: 480 }}
			/>

			{inactiveWidgets.length > 0 && (
				<div
					className="mt-4 p-4 border-t-2 border-dashed border-gray-300"
					style={{ maxWidth: 800 }}
				>
					<p className="text-sm text-gray-500 mb-3">
						Inactive widgets ({context.dayType} / {context.timeBlock})
					</p>
					<div className="grid grid-cols-2 gap-2">
						{inactiveWidgets.map((item) => (
							<div key={item?.type} className="opacity-60">
								{item?.element}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
