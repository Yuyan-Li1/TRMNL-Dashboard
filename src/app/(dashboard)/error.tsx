"use client";

import { useEffect } from "react";
import { EinkIcon } from "@/components/ui/EinkIcon";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log error for debugging
		console.error("Dashboard error:", error);
	}, [error]);

	return (
		<div className="trmnl-container flex items-center justify-center bg-eink-white">
			<div className="p-8 text-center">
				<EinkIcon name="alert" size="xl" className="mb-4" />

				<h1 className="mb-2 type-21 font-bold">Dashboard Error</h1>

				<p className="mb-4 type-16 text-eink-dark">
					Something went wrong loading the dashboard.
				</p>

				{process.env.NODE_ENV === "development" && (
					<pre className="mb-4 max-w-md overflow-auto bg-eink-light p-2 text-left type-12">
						{error.message}
					</pre>
				)}

				<button type="button" onClick={reset} className="eink-button">
					Try Again
				</button>
			</div>
		</div>
	);
}
