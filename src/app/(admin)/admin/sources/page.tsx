import { TestAlertButton } from "@/components/admin/TestAlertButton";
import { formatMoment } from "@/lib/alerts/alerts";
import { OWNER_TIME_ZONE } from "@/lib/config";
import { readLastSend } from "@/lib/health/alert";
import { formatDay, tokenExpiry } from "@/lib/health/checks";
import { SOURCE_IDS, SOURCES } from "@/lib/health/sources";
import { isStale, readRefreshStatus } from "@/lib/health/status";

export const dynamic = "force-dynamic";

const CELL = "px-4 py-2 text-left align-top";

function when(at: string | undefined): string {
	return at ? formatMoment(at, OWNER_TIME_ZONE) : "never";
}

export default async function SourceHealthPage(): Promise<React.JSX.Element> {
	const [status, lastSend] = await Promise.all([
		readRefreshStatus(),
		readLastSend(),
	]);
	const now = new Date();

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">Source health</h1>

			<div className="overflow-x-auto rounded-lg bg-white shadow">
				<table className="w-full text-sm text-gray-900">
					<thead className="border-b border-gray-200 text-gray-500">
						<tr>
							<th className={CELL}>Source</th>
							<th className={CELL}>Last good read</th>
							<th className={CELL}>Failures in a row</th>
							<th className={CELL}>Token</th>
							<th className={CELL}>Token expires</th>
							<th className={CELL}>Last error</th>
						</tr>
					</thead>
					<tbody>
						{SOURCE_IDS.map((id) => {
							const { name, kind, token } = SOURCES[id];
							const health = status?.sources[id];
							const expiresOn = tokenExpiry(id, status);
							return (
								<tr key={id} className="border-b border-gray-100">
									<td className={CELL}>
										{name}
										{kind === "catalog" && (
											<span className="text-gray-500"> (Catalog)</span>
										)}
									</td>
									<td className={CELL}>
										{when(health?.lastGoodReadAt)}
										{isStale(id, health, now) && (
											<span className="font-semibold text-red-700"> Stale</span>
										)}
									</td>
									<td className={CELL}>{health?.failuresInARow ?? 0}</td>
									<td className={CELL}>
										{token?.name ?? ""}
										{health?.rejected && (
											<span className="font-semibold text-red-700">
												{" "}
												Rejected
											</span>
										)}
									</td>
									<td className={CELL}>
										{expiresOn
											? formatDay(expiresOn)
											: token
												? "No expiry"
												: ""}
									</td>
									<td className={`${CELL} text-red-700`}>
										{health?.lastError ?? ""}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="space-y-3 rounded-lg bg-white p-6 text-sm text-gray-900 shadow">
				<p>Last refresh: {when(status?.lastSuccessAt)}</p>
				<p>
					Last Alert:{" "}
					{lastSend
						? `${lastSend.label}, ${when(lastSend.at)}, ${lastSend.ok ? "sent" : `send failed (${lastSend.error ?? "no reason given"})`}`
						: "none"}
				</p>
				<TestAlertButton />
			</div>
		</div>
	);
}
