"use client";

import { useState } from "react";

interface TestAlertResult {
	sent?: boolean;
	error?: string;
}

export function TestAlertButton(): React.JSX.Element {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<TestAlertResult | null>(null);

	const handleSend = async (): Promise<void> => {
		setLoading(true);
		setResult(null);

		try {
			const res = await fetch("/api/admin/test-alert", { method: "POST" });
			const data: TestAlertResult = await res.json();
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
				onClick={handleSend}
				disabled={loading}
				className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
			>
				{loading ? "Sending..." : "Send test Alert"}
			</button>

			{result && (
				<div
					className={`rounded px-3 py-2 text-xs ${
						result.sent
							? "bg-green-50 text-green-700"
							: "bg-red-50 text-red-700"
					}`}
				>
					{result.sent ? "Sent. Check Telegram." : (result.error ?? "Not sent")}
				</div>
			)}
		</div>
	);
}
