import { notFound } from "next/navigation";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { Schedule } from "@/lib/db/models/schedule";
import { connectToDatabase } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

export default async function EditSchedulePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	if (id === "new") {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold text-gray-900">New Schedule</h1>
				<ScheduleEditor />
			</div>
		);
	}

	await connectToDatabase();
	const schedule = await Schedule.findById(id).lean();

	if (!schedule) {
		notFound();
	}

	const initialData = {
		name: schedule.name,
		dayType: schedule.dayType,
		daysOfWeek: schedule.daysOfWeek,
		timeBlocks: schedule.timeBlocks.map((tb) => ({
			name: tb.name,
			startTime: tb.startTime,
			endTime: tb.endTime,
			widgets: tb.widgets.map((w) => ({
				type: w.type,
				priority: w.priority,
				enabled: w.enabled,
			})),
		})),
		isActive: schedule.isActive,
	};

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">Edit Schedule</h1>
			<ScheduleEditor initialData={initialData} scheduleId={id} />
		</div>
	);
}
