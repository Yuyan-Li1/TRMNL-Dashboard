import { checkPSNTokenHealth } from "@/lib/api/playstation";
import { LOCATION } from "@/lib/config";
import { TokenHealth } from "@/lib/db/models/token";
import { connectToDatabase } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

const serviceInfo: Record<string, { name: string; refreshUrl?: string }> = {
	psn: {
		name: "PlayStation Network",
		refreshUrl: "https://ca.account.sony.com/api/v1/ssocookie",
	},
	xbox: {
		name: "Xbox Live (OpenXBL)",
		refreshUrl: "https://xbl.io",
	},
	steam: {
		name: "Steam",
		refreshUrl: "https://steamcommunity.com/dev/apikey",
	},
	google: {
		name: "Google Calendar",
	},
	tfnsw: {
		name: "Transport NSW",
		refreshUrl: "https://opendata.transport.nsw.gov.au",
	},
};

export default async function TokensPage() {
	await connectToDatabase();
	const tokens = await TokenHealth.find({}).lean();

	// Get fresh PSN status
	let psnStatus: Awaited<ReturnType<typeof checkPSNTokenHealth>> | null = null;
	try {
		psnStatus = await checkPSNTokenHealth();
	} catch (error) {
		console.error("PSN check failed:", error);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">Token Health</h1>

			<div className="bg-white shadow overflow-hidden sm:rounded-lg">
				<ul className="divide-y divide-gray-200">
					{tokens.map((token) => {
						const info = serviceInfo[token.service];
						const isPSN = token.service === "psn";
						const status = isPSN && psnStatus ? psnStatus.status : token.status;
						const message =
							isPSN && psnStatus ? psnStatus.message : token.errorMessage;

						return (
							<li key={token.service} className="px-4 py-5 sm:px-6">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-lg font-medium text-gray-900">
											{info?.name || token.service}
										</h3>
										<div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
											<span>
												Last checked:{" "}
												{token.lastChecked
													? new Date(token.lastChecked).toLocaleString(
															LOCATION.locale,
															{ timeZone: LOCATION.timezone },
														)
													: "Never"}
											</span>
											{token.errorCount > 0 && (
												<span className="text-red-600">
													{token.errorCount} errors
												</span>
											)}
										</div>
										{message && (
											<p className="mt-1 text-sm text-yellow-600">{message}</p>
										)}
									</div>

									<div className="flex items-center gap-4">
										<StatusBadge status={status} />

										{info?.refreshUrl && (
											<a
												href={info.refreshUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm text-indigo-600 hover:text-indigo-500"
											>
												Refresh
											</a>
										)}
									</div>
								</div>

								{/* PSN-specific info */}
								{isPSN && psnStatus?.expiresAt && (
									<div className="mt-3 p-3 bg-gray-50 rounded-md">
										<p className="text-sm text-gray-600">
											NPSSO expires:{" "}
											<span className="font-medium">
												{new Date(psnStatus.expiresAt).toLocaleDateString(
													LOCATION.locale,
													{ timeZone: LOCATION.timezone },
												)}
											</span>
										</p>
										<p className="mt-1 text-xs text-gray-500">
											To refresh: Sign in at playstation.com, then visit the
											refresh URL
										</p>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			</div>

			{/* Refresh instructions */}
			<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
				<h3 className="text-sm font-medium text-blue-800">
					Token Refresh Instructions
				</h3>
				<div className="mt-2 text-sm text-blue-700">
					<p className="font-medium">PSN (PlayStation):</p>
					<ol className="list-decimal ml-4 mt-1 space-y-1">
						<li>
							Sign in at{" "}
							<a
								href="https://www.playstation.com"
								target="_blank"
								rel="noopener noreferrer"
								className="underline"
							>
								playstation.com
							</a>
						</li>
						<li>
							Visit{" "}
							<a
								href="https://ca.account.sony.com/api/v1/ssocookie"
								target="_blank"
								rel="noopener noreferrer"
								className="underline"
							>
								SSO Cookie endpoint
							</a>
						</li>
						<li>Copy the NPSSO token from the JSON response</li>
						<li>
							Update <code className="bg-blue-100 px-1 rounded">PSN_NPSSO</code>{" "}
							in Vercel environment variables
						</li>
						<li>Redeploy or wait for next refresh cycle</li>
					</ol>
				</div>
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		healthy: "bg-green-100 text-green-800",
		expiring_soon: "bg-yellow-100 text-yellow-800",
		expired: "bg-red-100 text-red-800",
		error: "bg-red-100 text-red-800",
	};

	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
				colors[status] || "bg-gray-100 text-gray-800"
			}`}
		>
			{status.replace("_", " ")}
		</span>
	);
}
