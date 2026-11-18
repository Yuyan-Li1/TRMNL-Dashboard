import Link from "next/link";
import { RefreshButton } from "@/components/admin/RefreshButton";
import type { DashboardData } from "@/lib/api/refresh";
import { CACHE_KEYS, cacheGetOrLatest } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

const LINK_CLASS =
	"inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50";

export default async function AdminDashboardPage() {
	const dashboardData = await cacheGetOrLatest<DashboardData>(
		CACHE_KEYS.DASHBOARD_DATA,
	);

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

			<div className="rounded-lg bg-white p-6 shadow">
				<p className="text-sm font-medium text-gray-500">Last refresh</p>
				<p className="mt-1 text-3xl font-semibold text-gray-900">
					{dashboardData?.refreshedAt
						? getTimeAgo(new Date(dashboardData.refreshedAt))
						: "No data"}
				</p>
				{dashboardData && dashboardData.errors.length > 0 && (
					<ul className="mt-3 list-disc pl-5 text-sm text-red-700">
						{dashboardData.errors.map((error) => (
							<li key={error}>{error}</li>
						))}
					</ul>
				)}
			</div>

			<div className="rounded-lg bg-white p-6 shadow">
				<div className="flex flex-wrap items-start gap-3">
					<RefreshButton />
					<Link href="/preview" target="_blank" className={LINK_CLASS}>
						Preview Dashboard
					</Link>
					<Link href="/admin/sources" className={LINK_CLASS}>
						Source health
					</Link>
					<Link href="/api/health" target="_blank" className={LINK_CLASS}>
						Health Check
					</Link>
				</div>
			</div>
		</div>
	);
}

function getTimeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

	if (seconds < 60) return "Just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}
