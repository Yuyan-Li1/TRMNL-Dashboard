import type { StatusStripView } from "@/lib/health/strip";
import { IgdbAttribution } from "./IgdbAttribution";
import { TmdbAttribution } from "./TmdbAttribution";
import { TraktAttribution } from "./TraktAttribution";

/**
 * The status strip: each source's last good read, the last refresh, the
 * last Alert and the home server, then the attribution lines. It sits below the 800x480 area the
 * device captures, so it is seen in a browser and never on the panel.
 */
export function StatusStrip({
	view,
}: {
	view: StatusStripView;
}): React.JSX.Element {
	return (
		<>
			<section
				aria-label="Status"
				className="w-[800px] px-5 pt-4 text-sm text-eink-dark"
			>
				<ul className="m-0 grid list-none grid-cols-4 gap-x-4 gap-y-1 p-0">
					{view.sources.map((source) => (
						<li key={source.name}>
							<span className="font-bold text-eink-black">{source.name}</span>{" "}
							{source.lastGoodRead}
							{source.stale && (
								<span className="font-bold text-eink-black"> Stale</span>
							)}
						</li>
					))}
				</ul>
				<p className="mt-2 mb-0">
					Last refresh {view.lastRefresh}. Last Alert:{" "}
					{view.lastAlert
						? `${view.lastAlert.label}, ${view.lastAlert.at}, ${view.lastAlert.sent ? "sent" : "send failed"}`
						: "none"}
					.
				</p>
				{view.home && (
					<p className="mt-1 mb-0">
						<span className="font-bold text-eink-black">Home server</span>{" "}
						{view.home.heartbeat}
						{view.home.stale && (
							<span className="font-bold text-eink-black"> Stale</span>
						)}
						{view.home.jobs.map((job) => (
							<span key={job.name}>
								. {job.name} {job.lastSuccess}
								{job.stale && (
									<span className="font-bold text-eink-black"> Stale</span>
								)}
							</span>
						))}
						.
						{view.home.claudeTokenExpires &&
							` Claude Code token expires ${view.home.claudeTokenExpires}.`}
					</p>
				)}
			</section>
			<TmdbAttribution />
			<TraktAttribution />
			<IgdbAttribution />
		</>
	);
}
