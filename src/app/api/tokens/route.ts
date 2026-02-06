import { NextResponse } from "next/server";
import { checkPSNTokenHealth } from "@/lib/api/playstation";
import { TokenHealth } from "@/lib/db/models/token";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET(): Promise<NextResponse> {
	await connectToDatabase();

	// Get all token health records
	const tokens = await TokenHealth.find({}).lean();

	// Get fresh PSN status
	const psnStatus = await checkPSNTokenHealth();

	// Build response
	const health = tokens.map((token) => ({
		service: token.service,
		status: token.service === "psn" ? psnStatus.status : token.status,
		lastChecked: token.lastChecked,
		lastSuccess: token.lastSuccess,
		expiresAt: token.service === "psn" ? psnStatus.expiresAt : token.expiresAt,
		message: token.service === "psn" ? psnStatus.message : token.errorMessage,
		errorCount: token.errorCount,
	}));

	// Check for any warnings
	const warnings = health.filter(
		(h) => h.status === "expiring_soon" || h.status === "expired",
	);

	return NextResponse.json({
		tokens: health,
		hasWarnings: warnings.length > 0,
		warnings: warnings.map((w) => ({
			service: w.service,
			status: w.status,
			message: w.message,
		})),
	});
}
