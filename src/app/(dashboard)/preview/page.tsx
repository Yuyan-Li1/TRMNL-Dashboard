import { DashboardScreen } from "@/components/DashboardScreen";
import { loadDashboardData } from "@/lib/dashboard/loader";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
	const dashboardData = await loadDashboardData();

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-800 p-8">
			<div className="relative">
				<div className="absolute -top-8 left-0 text-sm text-white">
					TRMNL Preview -- 800x480 -- {dashboardData.context.dayType} /{" "}
					{dashboardData.context.timeBlock}
				</div>

				<div className="rounded-lg bg-gray-900 p-4 shadow-2xl">
					<DashboardScreen data={dashboardData} />
				</div>

				<div className="absolute -bottom-16 left-0 font-mono text-xs text-white">
					<div>
						Widgets: {dashboardData.widgets.map((w) => w.type).join(", ")}
					</div>
					<div>Data age: {dashboardData.meta.dataAge || "N/A"}</div>
				</div>
			</div>
		</div>
	);
}
