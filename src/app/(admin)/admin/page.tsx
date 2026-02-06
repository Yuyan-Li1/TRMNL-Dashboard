import Link from "next/link";
import { CACHE_KEYS, cacheGet } from "@/lib/cache/redis";
import { Routine } from "@/lib/db/models/routine";
import { Schedule } from "@/lib/db/models/schedule";
import { TokenHealth } from "@/lib/db/models/token";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getScheduleContext } from "@/lib/schedule/context";

export const dynamic = "force-dynamic";

interface DashboardCacheData {
	refreshedAt?: string;
}

export default async function AdminDashboardPage() {
	await connectToDatabase();

	// Get counts
	const [scheduleCount, routineCount, tokens, context, dashboardData] =
		await Promise.all([
			Schedule.countDocuments({ isActive: true }),
			Routine.countDocuments({ isActive: true }),
			TokenHealth.find({}).lean(),
			getScheduleContext(),
			cacheGet<DashboardCacheData>(CACHE_KEYS.DASHBOARD_DATA),
		]);

	const tokenWarnings = tokens.filter(
		(t) => t.status === "expired" || t.status === "expiring_soon",
	);

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

			{/* Warning banner */}
			{tokenWarnings.length > 0 && (
				<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
					<div className="flex">
						<div className="ml-3">
							<p className="text-sm text-yellow-700">
								{tokenWarnings.length} token(s) need attention.{" "}
								<Link href="/admin/tokens" className="font-medium underline">
									View tokens
								</Link>
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Stats cards */}
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Active Schedules"
					value={scheduleCount}
					href="/admin/schedules"
				/>
				<StatCard
					title="Active Routines"
					value={routineCount}
					href="/admin/routines"
				/>
				<StatCard
					title="Token Health"
					value={`${tokens.length - tokenWarnings.length}/${tokens.length}`}
					status={tokenWarnings.length > 0 ? "warning" : "success"}
					href="/admin/tokens"
				/>
				<StatCard
					title="Data Age"
					value={
						dashboardData?.refreshedAt
							? getTimeAgo(new Date(dashboardData.refreshedAt))
							: "No data"
					}
					status={dashboardData ? "success" : "error"}
				/>
			</div>

			{/* Current context */}
			<div className="bg-white shadow rounded-lg p-6">
				<h2 className="text-lg font-medium text-gray-900 mb-4">
					Current Context
				</h2>
				<dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div>
						<dt className="text-sm font-medium text-gray-500">Day Type</dt>
						<dd className="mt-1 text-lg font-semibold text-gray-900 capitalize">
							{context.dayType}
						</dd>
					</div>
					<div>
						<dt className="text-sm font-medium text-gray-500">Time Block</dt>
						<dd className="mt-1 text-lg font-semibold text-gray-900 capitalize">
							{context.timeBlock}
						</dd>
					</div>
					<div>
						<dt className="text-sm font-medium text-gray-500">Date</dt>
						<dd className="mt-1 text-lg font-semibold text-gray-900">
							{context.date}
						</dd>
					</div>
					<div>
						<dt className="text-sm font-medium text-gray-500">Time</dt>
						<dd className="mt-1 text-lg font-semibold text-gray-900">
							{context.time}
						</dd>
					</div>
				</dl>

				{context.specialConditions.length > 0 && (
					<div className="mt-4 pt-4 border-t border-gray-200">
						<h3 className="text-sm font-medium text-gray-500 mb-2">
							Active Conditions
						</h3>
						<div className="flex flex-wrap gap-2">
							{context.specialConditions.map((condition) => (
								<span
									key={condition.message}
									className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
										condition.severity === "high"
											? "bg-red-100 text-red-800"
											: "bg-yellow-100 text-yellow-800"
									}`}
								>
									{condition.message}
								</span>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Quick actions */}
			<div className="bg-white shadow rounded-lg p-6">
				<h2 className="text-lg font-medium text-gray-900 mb-4">
					Quick Actions
				</h2>
				<div className="flex flex-wrap gap-3">
					<Link
						href="/preview"
						target="_blank"
						className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
					>
						Preview Dashboard
					</Link>
					<a
						href="/api/refresh"
						className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
					>
						Force Refresh
					</a>
					<Link
						href="/api/health"
						target="_blank"
						className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
					>
						Health Check
					</Link>
				</div>
			</div>
		</div>
	);
}

function StatCard({
	title,
	value,
	href,
	status,
}: {
	title: string;
	value: string | number;
	href?: string;
	status?: "success" | "warning" | "error";
}) {
	const statusColors = {
		success: "text-green-600",
		warning: "text-yellow-600",
		error: "text-red-600",
	};

	const content = (
		<div className="bg-white overflow-hidden shadow rounded-lg">
			<div className="p-5">
				<div className="flex items-center">
					<div className="flex-1">
						<p className="text-sm font-medium text-gray-500 truncate">
							{title}
						</p>
						<p
							className={`mt-1 text-3xl font-semibold ${status ? statusColors[status] : "text-gray-900"}`}
						>
							{value}
						</p>
					</div>
				</div>
			</div>
		</div>
	);

	if (href) {
		return <Link href={href}>{content}</Link>;
	}

	return content;
}

function getTimeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

	if (seconds < 60) return "Just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}
