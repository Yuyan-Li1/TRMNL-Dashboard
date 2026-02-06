import { DashboardScreen } from "@/components/DashboardScreen";
import { loadDashboardData } from "@/lib/dashboard/loader";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
	const dashboardData = await loadDashboardData();

	return (
		<div className="min-h-screen bg-gray-800 flex items-center justify-center p-8">
			<div className="relative">
				<div className="absolute -top-8 left-0 text-white text-sm">
					TRMNL Preview -- 800x480 -- {dashboardData.context.dayType} /{" "}
					{dashboardData.context.timeBlock}
				</div>

				<div className="bg-gray-900 p-4 rounded-lg shadow-2xl">
					<DashboardScreen data={dashboardData} footerLabel="Preview Mode" />
				</div>

				<div className="absolute -bottom-16 left-0 text-white text-xs font-mono">
					<div>
						Widgets: {dashboardData.widgets.map((w) => w.type).join(", ")}
					</div>
					<div>Data age: {dashboardData.meta.dataAge || "N/A"}</div>
				</div>
			</div>
		</div>
	);
}
