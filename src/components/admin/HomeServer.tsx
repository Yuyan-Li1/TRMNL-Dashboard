import type { HomeReport } from "@/lib/health/report";

const HEAD =
	"px-3 py-2 text-left font-normal whitespace-nowrap first:pl-0 last:pr-0";
const CELL = "px-3 py-3 text-left align-top first:pl-0 last:pr-0";

/** The home server on the source health page: its heartbeat and the Collector's jobs. */
export function HomeServer({
	home,
}: {
	home: HomeReport | null;
}): React.JSX.Element {
	if (!home) {
		return (
			<p className="m-0 text-eink-dark">
				The Collector has not reported yet. It is set up on the home server with{" "}
				<code>collector/setup.sh</code>.
			</p>
		);
	}
	return (
		<>
			<p className="m-0 text-eink-dark">
				Last heartbeat {home.heartbeat}
				{home.stale && <span className="font-bold text-signal"> Stale</span>},
				running commit {home.commit}. The heartbeat is Stale when it is more
				than 1 hour old.{" "}
				{home.claudeTokenExpires ? (
					<span
						className={
							home.claudeTokenExpiresSoon ? "font-bold text-signal" : undefined
						}
					>
						The Claude Code token expires {home.claudeTokenExpires}.
					</span>
				) : (
					"No Claude Code token is set."
				)}
			</p>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[760px] border-collapse">
					<thead className="border-b-2 border-eink-black text-eink-dark">
						<tr>
							<th scope="col" className={HEAD}>
								Job
							</th>
							<th scope="col" className={HEAD}>
								State
							</th>
							<th scope="col" className={HEAD}>
								Last attempt
							</th>
							<th scope="col" className={HEAD}>
								Last success
							</th>
							<th scope="col" className={`${HEAD} text-right`}>
								Failed runs
							</th>
						</tr>
					</thead>
					<tbody>
						{home.jobs.map((job) => (
							<tr key={job.id} className="border-b-2 border-eink-light">
								<th
									scope="row"
									className={`${CELL} font-bold whitespace-nowrap`}
								>
									{job.name}
								</th>
								<td
									className={`${CELL} ${job.trouble ? "font-bold text-signal" : ""}`}
								>
									{job.state}
									{job.detail && (
										<span className="block max-w-[70ch] font-normal break-words text-eink-dark">
											{job.detail}
										</span>
									)}
								</td>
								<td className={`${CELL} whitespace-nowrap`}>
									{job.lastAttempt}
								</td>
								<td className={`${CELL} whitespace-nowrap`}>
									{job.lastSuccess}
								</td>
								<td className={`${CELL} text-right`}>{job.failedRuns}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
