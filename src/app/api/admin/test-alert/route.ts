import { NextResponse } from "next/server";
import { sendTestAlert } from "@/lib/health/alert";

/**
 * POST /api/admin/test-alert
 * Sends a test Alert from the source health page
 */
export async function POST(): Promise<NextResponse> {
	try {
		const alert = await sendTestAlert();
		return NextResponse.json(
			{ sent: alert.ok, error: alert.error },
			{ status: alert.ok ? 200 : 502 },
		);
	} catch (error) {
		return NextResponse.json(
			{ sent: false, error: String(error) },
			{ status: 500 },
		);
	}
}
