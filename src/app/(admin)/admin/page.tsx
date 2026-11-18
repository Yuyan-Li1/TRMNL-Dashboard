import Link from "next/link";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { StateMark, TroubleNotes } from "@/components/admin/Trouble";
import { Screen } from "@/components/screen/Screen";
import { healthReport } from "@/lib/health/report";
import { readRefreshStatus } from "@/lib/health/status";
import { formatWhen } from "@/lib/screen/format";
import { loadScreen } from "@/lib/screen/load";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage(): Promise<React.JSX.Element> {
	const [status, view] = await Promise.all([
		readRefreshStatus(),
		loadScreen({ rememberPick: false }),
	]);
	const now = new Date();
	const report = healthReport(status, now);
	const troubled = report.rows.filter((row) => row.trouble);

	return (
		<div className="flex flex-col gap-10">
			<section className="flex flex-col gap-4">
				<h1
					className={`m-0 type-42 ${report.trouble ? "text-signal" : "text-eink-black"}`}
				>
					{report.headline}
				</h1>
				<p className="m-0 text-eink-dark">
					{status
						? `Last refresh ${report.lastRefresh}, ${formatWhen(status.lastSuccessAt, now)}. One runs every 15 minutes.`
						: "The refresh runs every 15 minutes. Run one now to fill the screen."}
				</p>
				<RefreshButton />
			</section>

			{troubled.length > 0 && (
				<section aria-label="Needs attention">
					<ul className="m-0 list-none border-t-2 border-eink-black p-0">
						{troubled.map((row) => (
							<li
								key={row.id}
								className="flex flex-col gap-1 border-b-2 border-eink-light py-3"
							>
								<p className="m-0">
									<StateMark row={row} />
									<span className="font-bold">{row.name}</span>{" "}
									<span className="font-bold text-signal">{row.state}</span>
								</p>
								<div className="pl-6">
									<TroubleNotes row={row} />
								</div>
							</li>
						))}
					</ul>
					<p className="mt-4 mb-0">
						<Link href="/admin/sources" className="admin-link">
							See every source
						</Link>
					</p>
				</section>
			)}

			<section className="flex flex-col gap-3">
				<h2 className="m-0 type-21 font-bold">On the screen now</h2>
				<div className="overflow-x-auto">
					<div className="w-fit bg-eink-black p-4">
						<Screen view={view} />
					</div>
				</div>
				<p className="m-0 max-w-[70ch] text-eink-dark">
					The device captures this every 15 minutes and picks the Spotlight
					again each time, so its next capture may show another Title.
				</p>
			</section>
		</div>
	);
}
