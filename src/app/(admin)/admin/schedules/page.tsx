import Link from "next/link";
import { Schedule } from "@/lib/db/models/schedule";
import { connectToDatabase } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SchedulesPage() {
	await connectToDatabase();
	const schedules = await Schedule.find({}).sort({ dayType: 1 }).lean();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
				<Link
					href="/admin/schedules/new"
					className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
				>
					Add Schedule
				</Link>
			</div>

			<div className="overflow-hidden bg-white shadow sm:rounded-md">
				<ul className="divide-y divide-gray-200">
					{schedules.map((schedule) => (
						<li key={schedule._id?.toString()}>
							<Link
								href={`/admin/schedules/${schedule._id}`}
								className="block hover:bg-gray-50"
							>
								<div className="px-4 py-4 sm:px-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center">
											<p className="truncate text-sm font-medium text-indigo-600">
												{schedule.name}
											</p>
											<span
												className={`ml-2 inline-flex rounded-full px-2 text-xs leading-5 font-semibold ${
													schedule.isActive
														? "bg-green-100 text-green-800"
														: "bg-gray-100 text-gray-800"
												}`}
											>
												{schedule.isActive ? "Active" : "Inactive"}
											</span>
										</div>
										<div className="ml-2 flex shrink-0">
											<span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium">
												{schedule.dayType}
											</span>
										</div>
									</div>
									<div className="mt-2 sm:flex sm:justify-between">
										<div className="sm:flex">
											<p className="flex items-center text-sm text-gray-500">
												Days:{" "}
												{schedule.daysOfWeek.map((d) => dayNames[d]).join(", ")}
											</p>
										</div>
										<div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
											<p>{schedule.timeBlocks.length} time blocks</p>
										</div>
									</div>
								</div>
							</Link>
						</li>
					))}

					{schedules.length === 0 && (
						<li className="px-4 py-8 text-center text-gray-500">
							No schedules configured. Create one to get started.
						</li>
					)}
				</ul>
			</div>
		</div>
	);
}
