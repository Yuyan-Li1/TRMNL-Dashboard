import { DashboardScreen } from "@/components/DashboardScreen";
import { loadDashboardData } from "@/lib/dashboard/loader";

// Force dynamic rendering (no static generation)
export const dynamic = "force-dynamic";

// Disable caching for this page
export const revalidate = 0;

export default async function DashboardPage() {
	const dashboardData = await loadDashboardData();

	return <DashboardScreen data={dashboardData} />;
}
