"use client";

import { useRouter } from "next/navigation";
import { type Outcome, PostButton } from "./PostButton";

interface TestAlertResult {
	sent?: boolean;
	error?: string;
}

function describe(body: unknown): Outcome {
	const result = body as TestAlertResult;
	return result.sent
		? { ok: true, message: "Test Alert sent. Check Telegram." }
		: {
				ok: false,
				message: `Test Alert not sent: ${result.error ?? "Telegram gave no reason"}.`,
			};
}

export function TestAlertButton(): React.JSX.Element {
	const router = useRouter();

	return (
		<PostButton
			endpoint="/api/admin/test-alert"
			label="Send test Alert"
			busyLabel="Sending"
			describe={describe}
			onDone={() => router.refresh()}
		/>
	);
}
