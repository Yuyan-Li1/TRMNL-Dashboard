"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DayType, TimeBlock, WidgetType } from "@/types";

interface TimeBlockConfig {
	_id?: string;
	name: TimeBlock;
	startTime: string;
	endTime: string;
	widgets: Array<{
		type: WidgetType;
		priority: number;
		enabled: boolean;
	}>;
}

interface ScheduleFormData {
	name: string;
	dayType: DayType;
	daysOfWeek: number[];
	timeBlocks: TimeBlockConfig[];
	isActive: boolean;
}

interface ScheduleEditorProps {
	initialData?: ScheduleFormData;
	scheduleId?: string;
}

const dayOptions = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
];

const widgetOptions: WidgetType[] = [
	"weather",
	"transit",
	"calendar",
	"gaming",
	"routine",
	"medication",
];

export function ScheduleEditor({
	initialData,
	scheduleId,
}: ScheduleEditorProps) {
	const router = useRouter();
	const nextId = useRef(0);
	const [formData, setFormData] = useState<ScheduleFormData>(() => {
		const data = initialData || {
			name: "",
			dayType: "office",
			daysOfWeek: [],
			timeBlocks: [],
			isActive: true,
		};
		// Assign stable IDs to existing blocks
		for (const block of data.timeBlocks) {
			if (!block._id) block._id = `tb-${nextId.current++}`;
		}
		return data;
	});
	const [saving, setSaving] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);

		try {
			const method = scheduleId ? "PUT" : "POST";
			const url = scheduleId
				? `/api/admin/schedules/${scheduleId}`
				: "/api/admin/schedules";

			// Strip client-side _id from time blocks before sending to API
			const payload = {
				...formData,
				timeBlocks: formData.timeBlocks.map(({ _id, ...block }) => block),
			};

			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error("Failed to save");

			router.push("/admin/schedules");
			router.refresh();
		} catch (error) {
			console.error("Save failed:", error);
			alert("Failed to save schedule");
		} finally {
			setSaving(false);
		}
	};

	const addTimeBlock = () => {
		const id = `tb-${nextId.current++}`;
		setFormData((prev) => ({
			...prev,
			timeBlocks: [
				...prev.timeBlocks,
				{
					_id: id,
					name: "morning" as TimeBlock,
					startTime: "06:00",
					endTime: "09:00",
					widgets: [],
				},
			],
		}));
	};

	const removeTimeBlock = (index: number) => {
		setFormData((prev) => ({
			...prev,
			timeBlocks: prev.timeBlocks.filter((_, i) => i !== index),
		}));
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{/* Basic info */}
			<div className="bg-white shadow rounded-lg p-6">
				<h2 className="text-lg font-medium text-gray-900 mb-4">
					Basic Information
				</h2>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label className="block text-sm font-medium text-gray-700">
							Name
							<input
								type="text"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
								className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
								required
							/>
						</label>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700">
							Day Type
							<select
								value={formData.dayType}
								onChange={(e) =>
									setFormData({
										...formData,
										dayType: e.target.value as DayType,
									})
								}
								className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
							>
								<option value="office">Office</option>
								<option value="wfh">Work From Home</option>
								<option value="weekend">Weekend</option>
							</select>
						</label>
					</div>
				</div>

				<div className="mt-4">
					<span className="block text-sm font-medium text-gray-700 mb-2">
						Days of Week
					</span>
					<div className="flex flex-wrap gap-2">
						{dayOptions.map((day) => (
							<label
								key={day.value}
								className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer ${
									formData.daysOfWeek.includes(day.value)
										? "bg-indigo-100 text-indigo-800"
										: "bg-gray-100 text-gray-600"
								}`}
							>
								<input
									type="checkbox"
									className="sr-only"
									checked={formData.daysOfWeek.includes(day.value)}
									onChange={(e) => {
										if (e.target.checked) {
											setFormData({
												...formData,
												daysOfWeek: [...formData.daysOfWeek, day.value].sort(),
											});
										} else {
											setFormData({
												...formData,
												daysOfWeek: formData.daysOfWeek.filter(
													(d) => d !== day.value,
												),
											});
										}
									}}
								/>
								{day.label.slice(0, 3)}
							</label>
						))}
					</div>
				</div>

				<div className="mt-4">
					<label className="flex items-center">
						<input
							type="checkbox"
							checked={formData.isActive}
							onChange={(e) =>
								setFormData({ ...formData, isActive: e.target.checked })
							}
							className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
						/>
						<span className="ml-2 text-sm text-gray-700">Active</span>
					</label>
				</div>
			</div>

			{/* Time blocks */}
			<div className="bg-white shadow rounded-lg p-6">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-lg font-medium text-gray-900">Time Blocks</h2>
					<button
						type="button"
						onClick={addTimeBlock}
						className="text-sm text-indigo-600 hover:text-indigo-500"
					>
						+ Add Time Block
					</button>
				</div>

				<div className="space-y-4">
					{formData.timeBlocks.map((block, blockIndex) => (
						<TimeBlockEditor
							key={block._id ?? `tb-fallback-${blockIndex}`}
							block={block}
							onChange={(updated) => {
								const newBlocks = [...formData.timeBlocks];
								newBlocks[blockIndex] = updated;
								setFormData({ ...formData, timeBlocks: newBlocks });
							}}
							onRemove={() => removeTimeBlock(blockIndex)}
						/>
					))}

					{formData.timeBlocks.length === 0 && (
						<p className="text-gray-500 text-sm">
							No time blocks. Add one to configure widgets.
						</p>
					)}
				</div>
			</div>

			{/* Submit */}
			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={() => router.back()}
					className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving}
					className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
				>
					{saving ? "Saving..." : "Save Schedule"}
				</button>
			</div>
		</form>
	);
}

function TimeBlockEditor({
	block,
	onChange,
	onRemove,
}: {
	block: TimeBlockConfig;
	onChange: (block: TimeBlockConfig) => void;
	onRemove: () => void;
}) {
	return (
		<div className="border rounded-lg p-4">
			<div className="flex justify-between items-start mb-3">
				<div className="grid grid-cols-3 gap-3 flex-1">
					<div>
						<label className="block text-xs font-medium text-gray-500">
							Block Type
							<select
								value={block.name}
								onChange={(e) =>
									onChange({ ...block, name: e.target.value as TimeBlock })
								}
								className="mt-1 block w-full rounded border-gray-300 text-sm"
							>
								<option value="morning">Morning</option>
								<option value="workday">Workday</option>
								<option value="evening">Evening</option>
								<option value="night">Night</option>
							</select>
						</label>
					</div>
					<div>
						<label className="block text-xs font-medium text-gray-500">
							Start Time
							<input
								type="text"
								inputMode="numeric"
								pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
								placeholder="HH:mm"
								maxLength={5}
								value={block.startTime}
								onChange={(e) =>
									onChange({ ...block, startTime: e.target.value })
								}
								className="mt-1 block w-full rounded border-gray-300 text-sm"
							/>
						</label>
					</div>
					<div>
						<label className="block text-xs font-medium text-gray-500">
							End Time
							<input
								type="text"
								inputMode="numeric"
								pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
								placeholder="HH:mm"
								maxLength={5}
								value={block.endTime}
								onChange={(e) =>
									onChange({ ...block, endTime: e.target.value })
								}
								className="mt-1 block w-full rounded border-gray-300 text-sm"
							/>
						</label>
					</div>
				</div>
				<button
					type="button"
					onClick={onRemove}
					className="ml-2 text-red-600 hover:text-red-500 text-sm"
				>
					Remove
				</button>
			</div>

			<div>
				<span className="block text-xs font-medium text-gray-500 mb-2">
					Widgets
				</span>
				<div className="flex flex-wrap gap-2">
					{widgetOptions.map((widget) => {
						const isSelected = block.widgets.some((w) => w.type === widget);
						return (
							<button
								key={widget}
								type="button"
								onClick={() => {
									if (isSelected) {
										onChange({
											...block,
											widgets: block.widgets.filter((w) => w.type !== widget),
										});
									} else {
										onChange({
											...block,
											widgets: [
												...block.widgets,
												{
													type: widget,
													priority: block.widgets.length + 1,
													enabled: true,
												},
											],
										});
									}
								}}
								className={`px-2 py-1 rounded text-xs ${
									isSelected
										? "bg-indigo-100 text-indigo-800"
										: "bg-gray-100 text-gray-600"
								}`}
							>
								{widget}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
