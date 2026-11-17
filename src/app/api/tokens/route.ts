import { NextResponse } from "next/server";
import { checkPSNTokenHealth } from "@/lib/api/playstation";

/**
 * Reports the live PSN token check only. Read by the token-expiry workflow
 * until Telegram Alerts replace it.
 */
export async function GET(): Promise<NextResponse> {
	const psn = await checkPSNTokenHealth();
	const tokens = [{ service: "psn", ...psn }];
	const warnings = tokens.filter((token) => token.status !== "healthy");

	return NextResponse.json({
		tokens,
		hasWarnings: warnings.length > 0,
		warnings,
	});
}
