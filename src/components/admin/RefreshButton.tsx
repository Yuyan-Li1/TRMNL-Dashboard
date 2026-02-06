"use client";

import { useState } from "react";

interface RefreshResult {
	success?: boolean;
	duration?: string;
	errors?: string[];
	summary?: Record<string, string>;
	error?: string;
}

export function RefreshButton() {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<RefreshResult | null>(null);

	const handleRefresh = async () => {
		setLoading(true);
		setResult(null);

		try {
			const res = await fetch("/api/admin/refresh", { method: "POST" });
			const data: RefreshResult = await res.json();
			setResult(data);
		} catch {
			setResult({ error: "Network error" });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="inline-flex flex-col items-start gap-2">
			<button
				type="button"
				onClick={handleRefresh}
				disabled={loading}
				className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
			>
				{loading ? "Refreshing..." : "Refresh Data Now"}
			</button>

			{result && (
				<div
					className={`text-xs px-3 py-2 rounded ${
						result.error || !result.success
							? "bg-red-50 text-red-700"
							: "bg-green-50 text-green-700"
					}`}
				>
					{result.error ? (
						<span>{result.error}</span>
					) : (
						<span>
							Done in {result.duration}
							{result.errors && result.errors.length > 0 && (
								<> — {result.errors.join(", ")}</>
							)}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
