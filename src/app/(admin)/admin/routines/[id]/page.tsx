"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface RoutineStep {
	order: number;
	title: string;
	description?: string;
	duration?: number;
	isOptional: boolean;
}

interface RoutineFormData {
	name: string;
	category: string;
	steps: RoutineStep[];
	recurrence: { type: string; daysOfWeek?: number[] };
	timeWindow: { startTime: string; endTime: string };
	isActive: boolean;
}

const dayOptions = [
	{ value: 0, label: "Sun" },
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
];

const emptyForm: RoutineFormData = {
	name: "",
	category: "custom",
	steps: [],
	recurrence: { type: "daily" },
	timeWindow: { startTime: "06:00", endTime: "09:00" },
	isActive: true,
};

export default function EditRoutinePage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const isNew = params.id === "new";

	const [formData, setFormData] = useState<RoutineFormData>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(!isNew);

	useEffect(() => {
		if (!isNew) {
			fetch(`/api/admin/routines/${params.id}`)
				.then((r) => r.json())
				.then((data) => {
					setFormData({
						name: data.name,
						category: data.category,
						steps: data.steps,
						recurrence: data.recurrence,
						timeWindow: data.timeWindow,
						isActive: data.isActive,
					});
					setLoading(false);
				})
				.catch(() => {
					alert("Failed to load routine");
					router.push("/admin/routines");
				});
		}
	}, [isNew, params.id, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);

		try {
			const method = isNew ? "POST" : "PUT";
			const url = isNew
				? "/api/admin/routines"
				: `/api/admin/routines/${params.id}`;

			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			if (!res.ok) throw new Error("Failed to save");
			router.push("/admin/routines");
			router.refresh();
		} catch {
			alert("Failed to save routine");
		} finally {
			setSaving(false);
		}
	};

	const addStep = () => {
		setFormData((prev) => ({
			...prev,
			steps: [
				...prev.steps,
				{
					order: prev.steps.length + 1,
					title: "",
					isOptional: false,
				},
			],
		}));
	};

	const removeStep = (index: number) => {
		setFormData((prev) => ({
			...prev,
			steps: prev.steps
				.filter((_, i) => i !== index)
				.map((s, i) => ({ ...s, order: i + 1 })),
		}));
	};

	const moveStep = (index: number, direction: "up" | "down") => {
		setFormData((prev) => {
			const steps = [...prev.steps];
			const target = direction === "up" ? index - 1 : index + 1;
			if (target < 0 || target >= steps.length) return prev;
			[steps[index], steps[target]] = [steps[target], steps[index]];
			return {
				...prev,
				steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
			};
		});
	};

	if (loading) {
		return <div className="text-gray-500">Loading...</div>;
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				{isNew ? "New Routine" : "Edit Routine"}
			</h1>

			<form onSubmit={handleSubmit} className="space-y-6">
				<div className="bg-white shadow rounded-lg p-6">
					<h2 className="text-lg font-medium text-gray-900 mb-4">Details</h2>
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
								Category
								<select
									value={formData.category}
									onChange={(e) =>
										setFormData({ ...formData, category: e.target.value })
									}
									className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
								>
									<option value="morning">Morning</option>
									<option value="evening">Evening</option>
									<option value="medication">Medication</option>
									<option value="skincare">Skincare</option>
									<option value="custom">Custom</option>
								</select>
							</label>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700">
								Start Time
								<input
									type="text"
									inputMode="numeric"
									pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
									placeholder="HH:mm"
									maxLength={5}
									value={formData.timeWindow.startTime}
									onChange={(e) =>
										setFormData({
											...formData,
											timeWindow: {
												...formData.timeWindow,
												startTime: e.target.value,
											},
										})
									}
									className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
								/>
							</label>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700">
								End Time
								<input
									type="text"
									inputMode="numeric"
									pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
									placeholder="HH:mm"
									maxLength={5}
									value={formData.timeWindow.endTime}
									onChange={(e) =>
										setFormData({
											...formData,
											timeWindow: {
												...formData.timeWindow,
												endTime: e.target.value,
											},
										})
									}
									className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
								/>
							</label>
						</div>
					</div>

					<div className="mt-4">
						<label className="block text-sm font-medium text-gray-700">
							Recurrence
							<select
								value={formData.recurrence.type}
								onChange={(e) =>
									setFormData({
										...formData,
										recurrence: {
											...formData.recurrence,
											type: e.target.value,
										},
									})
								}
								className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
							>
								<option value="daily">Daily</option>
								<option value="weekly">Weekly</option>
							</select>
						</label>
					</div>

					{formData.recurrence.type === "weekly" && (
						<div className="mt-4">
							<span className="block text-sm font-medium text-gray-700 mb-2">
								Days
							</span>
							<div className="flex flex-wrap gap-2">
								{dayOptions.map((day) => (
									<label
										key={day.value}
										className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer ${
											formData.recurrence.daysOfWeek?.includes(day.value)
												? "bg-indigo-100 text-indigo-800"
												: "bg-gray-100 text-gray-600"
										}`}
									>
										<input
											type="checkbox"
											className="sr-only"
											checked={
												formData.recurrence.daysOfWeek?.includes(day.value) ??
												false
											}
											onChange={(e) => {
												const days = formData.recurrence.daysOfWeek ?? [];
												const updated = e.target.checked
													? [...days, day.value].sort()
													: days.filter((d) => d !== day.value);
												setFormData({
													...formData,
													recurrence: {
														...formData.recurrence,
														daysOfWeek: updated,
													},
												});
											}}
										/>
										{day.label}
									</label>
								))}
							</div>
						</div>
					)}

					<div className="mt-4">
						<label className="flex items-center">
							<input
								type="checkbox"
								checked={formData.isActive}
								onChange={(e) =>
									setFormData({ ...formData, isActive: e.target.checked })
								}
								className="rounded border-gray-300 text-indigo-600"
							/>
							<span className="ml-2 text-sm text-gray-700">Active</span>
						</label>
					</div>
				</div>

				<div className="bg-white shadow rounded-lg p-6">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-lg font-medium text-gray-900">Steps</h2>
						<button
							type="button"
							onClick={addStep}
							className="text-sm text-indigo-600 hover:text-indigo-500"
						>
							+ Add Step
						</button>
					</div>

					<div className="space-y-4">
						{formData.steps.map((step, index) => (
							<div key={step.order} className="border rounded-lg p-4">
								<div className="flex justify-between items-center mb-3">
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium text-gray-500">
											Step {index + 1}
										</span>
										<div className="flex gap-1">
											<button
												type="button"
												onClick={() => moveStep(index, "up")}
												disabled={index === 0}
												className="px-1.5 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
											>
												&uarr;
											</button>
											<button
												type="button"
												onClick={() => moveStep(index, "down")}
												disabled={index === formData.steps.length - 1}
												className="px-1.5 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
											>
												&darr;
											</button>
										</div>
									</div>
									<button
										type="button"
										onClick={() => removeStep(index)}
										className="text-red-600 hover:text-red-500 text-xs"
									>
										Remove
									</button>
								</div>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
									<div className="sm:col-span-2">
										<input
											type="text"
											value={step.title}
											onChange={(e) => {
												const steps = [...formData.steps];
												steps[index] = { ...step, title: e.target.value };
												setFormData({ ...formData, steps });
											}}
											placeholder="Step title"
											className="block w-full rounded border-gray-300 text-sm"
											required
										/>
									</div>
									<div>
										<input
											type="number"
											value={step.duration ?? ""}
											onChange={(e) => {
												const steps = [...formData.steps];
												steps[index] = {
													...step,
													duration: e.target.value
														? Number(e.target.value)
														: undefined,
												};
												setFormData({ ...formData, steps });
											}}
											placeholder="Duration (min)"
											className="block w-full rounded border-gray-300 text-sm"
											min="1"
										/>
									</div>
								</div>
							</div>
						))}

						{formData.steps.length === 0 && (
							<p className="text-gray-500 text-sm">
								No steps. Add one to build the routine.
							</p>
						)}
					</div>
				</div>

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
						{saving ? "Saving..." : "Save Routine"}
					</button>
				</div>
			</form>
		</div>
	);
}
