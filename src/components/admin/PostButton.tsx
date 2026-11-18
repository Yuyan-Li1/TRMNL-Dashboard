"use client";

import { useState } from "react";

/** What came of the request, in words for the owner. */
export interface Outcome {
	ok: boolean;
	message: string;
}

interface PostButtonProps {
	endpoint: string;
	label: string;
	busyLabel: string;
	/** Reads the endpoint's JSON answer */
	describe: (body: unknown, ok: boolean) => Outcome;
	onDone?: () => void;
}

/** A button that POSTs to an admin endpoint and says beside it what happened. */
export function PostButton({
	endpoint,
	label,
	busyLabel,
	describe,
	onDone,
}: PostButtonProps): React.JSX.Element {
	const [busy, setBusy] = useState(false);
	const [outcome, setOutcome] = useState<Outcome | null>(null);

	const handleClick = async (): Promise<void> => {
		setBusy(true);
		setOutcome(null);

		try {
			const res = await fetch(endpoint, { method: "POST" });
			const body: unknown = await res.json();
			setOutcome(describe(body, res.ok));
			onDone?.();
		} catch {
			setOutcome({
				ok: false,
				message: "The request did not reach the server. Try again.",
			});
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<button
				type="button"
				onClick={handleClick}
				disabled={busy}
				className="admin-button"
			>
				{busy ? busyLabel : label}
			</button>
			<p
				role="status"
				className={`m-0 min-w-0 ${outcome && !outcome.ok ? "font-bold text-signal" : ""}`}
			>
				{outcome?.message}
			</p>
		</div>
	);
}
