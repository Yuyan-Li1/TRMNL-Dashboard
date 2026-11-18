import Link from "next/link";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { StateMark, TroubleNotes } from "@/components/admin/Trouble";
import { Screen } from "@/components/screen/Screen";
import { readHomeStatus } from "@/lib/health/home";
import { healthReport } from "@/lib/health/report";
import { readRefreshStatus } from "@/lib/health/status";
import { formatWhen } from "@/lib/screen/format";
import { loadScreen } from "@/lib/screen/load";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage(): Promise<React.JSX.Element> {
	const [status, home, view] = await Promise.all([
		readRefreshStatus(),
		readHomeStatus(),
		loadScreen({ rememberPick: false }),
	]);
	const now = new Date();
	const report = healthReport(status, now, home);
	const troubled = report.rows.filter((row) => row.trouble);
	const homeTroubled = report.home?.troubled ?? [];

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

			{troubled.length + homeTroubled.length > 0 && (
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
						{homeTroubled.map((name) => (
							<li key={name} className="border-b-2 border-eink-light py-3">
								<span
									aria-hidden="true"
									className="mr-3 inline-block size-3 border-2 border-signal bg-signal"
								/>
								<span className="font-bold">{name}</span>{" "}
								<span className="font-bold text-signal">
									on the home server
								</span>
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
