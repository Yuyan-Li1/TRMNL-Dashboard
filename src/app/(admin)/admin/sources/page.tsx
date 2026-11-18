import { HomeServer } from "@/components/admin/HomeServer";
import { TestAlertButton } from "@/components/admin/TestAlertButton";
import { StateMark, TroubleNotes } from "@/components/admin/Trouble";
import { readLastSend } from "@/lib/health/alert";
import { readHomeStatus } from "@/lib/health/home";
import { healthReport } from "@/lib/health/report";
import { readRefreshStatus } from "@/lib/health/status";
import { formatWhenOrNever } from "@/lib/health/strip";

export const dynamic = "force-dynamic";

const HEAD =
	"px-3 py-2 text-left font-normal whitespace-nowrap first:pl-0 last:pr-0";
const CELL = "px-3 pt-3 text-left align-top first:pl-0 last:pr-0";

export default async function SourceHealthPage(): Promise<React.JSX.Element> {
	const [status, lastSend, home] = await Promise.all([
		readRefreshStatus(),
		readLastSend(),
		readHomeStatus(),
	]);
	const report = healthReport(status, new Date(), home);

	return (
		<div className="flex flex-col gap-12">
			<section className="flex flex-col gap-4">
				<h1 className="m-0 type-42">Sources</h1>
				<p className="m-0 text-eink-dark">
					Last refresh {report.lastRefresh}. A Source is Stale when its last
					good read is more than 2 hours old.
				</p>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[760px] border-collapse">
						<thead className="border-b-2 border-eink-black text-eink-dark">
							<tr>
								<th scope="col" className={HEAD}>
									Source
								</th>
								<th scope="col" className={HEAD}>
									State
								</th>
								<th scope="col" className={HEAD}>
									Last good read
								</th>
								<th scope="col" className={`${HEAD} text-right`}>
									Failed runs
								</th>
								<th scope="col" className={HEAD}>
									Token
								</th>
							</tr>
						</thead>
						{report.rows.map((row) => (
							<tbody key={row.id} className="border-b-2 border-eink-light">
								<tr>
									<th
										scope="row"
										className={`${CELL} font-bold whitespace-nowrap`}
									>
										<StateMark row={row} />
										{row.name}
										{row.catalog && (
											<span className="font-normal text-eink-dark">
												{" "}
												Catalog
											</span>
										)}
									</th>
									<td
										className={`${CELL} whitespace-nowrap ${row.failedRuns > 0 || row.state === "Stale" || row.state === "Never read" ? "font-bold text-signal" : ""}`}
									>
										{row.state}
									</td>
									<td className={`${CELL} whitespace-nowrap`}>
										{row.lastGoodRead}
									</td>
									<td className={`${CELL} text-right`}>{row.failedRuns}</td>
									<td className={`${CELL} whitespace-nowrap`}>
										{row.token}
										{row.expires && (
											<span
												className={`block ${row.expiresSoon ? "font-bold text-signal" : "text-eink-dark"}`}
											>
												{row.expires === "No expiry" ||
												row.expires === "Not known yet"
													? row.expires
													: `Expires ${row.expires}`}
											</span>
										)}
									</td>
								</tr>
								<tr>
									<td colSpan={5} className="pt-1 pb-3 pl-6">
										<TroubleNotes row={row} />
									</td>
								</tr>
							</tbody>
						))}
					</table>
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="m-0 type-21 font-bold">Home server</h2>
				<HomeServer home={report.home} />
			</section>
			<section className="flex flex-col gap-4">
				<h2 className="m-0 type-21 font-bold">Alerts</h2>
				<p className="m-0 text-eink-dark">
					{lastSend ? (
						<>
							Last Alert: {lastSend.label}, {formatWhenOrNever(lastSend.at)},{" "}
							{lastSend.ok ? (
								"sent."
							) : (
								<span className="font-bold text-signal">
									not sent ({lastSend.error ?? "Telegram gave no reason"}).
								</span>
							)}
						</>
					) : (
						"No Alert has been sent yet."
					)}
				</p>
				<TestAlertButton />
			</section>
		</div>
	);
}
