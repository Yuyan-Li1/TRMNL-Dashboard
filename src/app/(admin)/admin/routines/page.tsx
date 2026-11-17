import Link from "next/link";
import { Routine } from "@/lib/db/models/routine";
import { connectToDatabase } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function RoutinesPage() {
	await connectToDatabase();
	const routines = await Routine.find({}).sort({ category: 1, name: 1 }).lean();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">Routines</h1>
				<Link
					href="/admin/routines/new"
					className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
				>
					Add Routine
				</Link>
			</div>

			<div className="overflow-hidden bg-white shadow sm:rounded-md">
				<ul className="divide-y divide-gray-200">
					{routines.map((routine) => (
						<li key={routine._id?.toString()}>
							<Link
								href={`/admin/routines/${routine._id}`}
								className="block hover:bg-gray-50"
							>
								<div className="px-4 py-4 sm:px-6">
									<div className="flex items-center justify-between">
										<div className="flex items-center">
											<p className="truncate text-sm font-medium text-indigo-600">
												{routine.name}
											</p>
											<span
												className={`ml-2 inline-flex rounded-full px-2 text-xs leading-5 font-semibold ${
													routine.isActive
														? "bg-green-100 text-green-800"
														: "bg-gray-100 text-gray-800"
												}`}
											>
												{routine.isActive ? "Active" : "Inactive"}
											</span>
										</div>
										<div className="ml-2 flex shrink-0">
											<span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium capitalize">
												{routine.category}
											</span>
										</div>
									</div>
									<div className="mt-2 sm:flex sm:justify-between">
										<div className="sm:flex">
											<p className="flex items-center text-sm text-gray-500">
												{routine.steps.length} steps
											</p>
											<p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
												{routine.timeWindow.startTime} -{" "}
												{routine.timeWindow.endTime}
											</p>
										</div>
										<div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
											{routine.recurrence.type === "daily" ? (
												<span>Daily</span>
											) : (
												<span>
													{routine.recurrence.daysOfWeek
														?.map((d) => dayNames[d])
														.join(", ")}
												</span>
											)}
										</div>
									</div>
								</div>
							</Link>
						</li>
					))}

					{routines.length === 0 && (
						<li className="px-4 py-8 text-center text-gray-500">
							No routines configured. Create one to get started.
						</li>
					)}
				</ul>
			</div>
		</div>
	);
}
