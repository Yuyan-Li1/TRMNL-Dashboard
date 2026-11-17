import { DashboardScreen } from "@/components/DashboardScreen";
import { loadDashboardData } from "@/lib/dashboard/loader";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
	const dashboardData = await loadDashboardData();

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-800 p-8">
			<div className="relative">
				<div className="absolute -top-8 left-0 text-sm text-white">
					TRMNL Preview -- 800x480
				</div>

				<div className="rounded-lg bg-gray-900 p-4 shadow-2xl">
					<DashboardScreen data={dashboardData} />
				</div>

				<div className="absolute -bottom-8 left-0 font-mono text-xs text-white">
					Refreshed: {dashboardData.refreshedAt ?? "never"}
				</div>
			</div>
		</div>
	);
}
