"use client";

import { useRouter } from "next/navigation";
import { type Outcome, PostButton } from "./PostButton";

interface RefreshResult {
	duration?: string;
	errors?: string[];
	error?: string;
	details?: string;
}

function seconds(duration: string | undefined): string {
	const ms = Number.parseInt(duration ?? "", 10);
	return Number.isNaN(ms) ? "" : ` in ${(ms / 1000).toFixed(1)} seconds`;
}

function describe(body: unknown, ok: boolean): Outcome {
	const result = body as RefreshResult;
	if (!ok || result.error) {
		return {
			ok: false,
			message: `Not refreshed: ${result.details ?? result.error ?? "the server gave no reason"}.`,
		};
	}
	if (result.errors && result.errors.length > 0) {
		return {
			ok: false,
			message: `Refreshed${seconds(result.duration)}, with errors: ${result.errors.join("; ")}.`,
		};
	}
	return { ok: true, message: `Refreshed${seconds(result.duration)}.` };
}

/** Runs the refresh now, then shows the page again with what it found. */
export function RefreshButton(): React.JSX.Element {
	const router = useRouter();

	return (
		<PostButton
			endpoint="/api/admin/refresh"
			label="Refresh now"
			busyLabel="Refreshing"
			describe={describe}
			onDone={() => router.refresh()}
		/>
	);
}
