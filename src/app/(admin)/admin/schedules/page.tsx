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
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
				<Link
					href="/admin/schedules/new"
					className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
				>
					Add Schedule
				</Link>
			</div>

			<div className="bg-white shadow overflow-hidden sm:rounded-md">
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
											<p className="text-sm font-medium text-indigo-600 truncate">
												{schedule.name}
											</p>
											<span
												className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
													schedule.isActive
														? "bg-green-100 text-green-800"
														: "bg-gray-100 text-gray-800"
												}`}
											>
												{schedule.isActive ? "Active" : "Inactive"}
											</span>
										</div>
										<div className="ml-2 shrink-0 flex">
											<span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded">
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
