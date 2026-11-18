import type { HealthRow } from "@/lib/health/report";

/** The square beside a source: black when reading, the signal colour in trouble. */
export function StateMark({ row }: { row: HealthRow }): React.JSX.Element {
	const fill = row.trouble
		? "border-signal bg-signal"
		: row.state === "Reading"
			? "border-eink-black bg-eink-black"
			: "border-eink-light";
	return (
		<span
			aria-hidden="true"
			className={`mr-3 inline-block size-3 border-2 ${fill}`}
		/>
	);
}

/** Why a source is in trouble and what to do about it. */
export function TroubleNotes({
	row,
}: {
	row: HealthRow;
}): React.JSX.Element | null {
	if (!row.detail && !row.fix && !row.expiresSoon) {
		return null;
	}
	return (
		<div className="flex max-w-[70ch] flex-col gap-1 text-eink-dark">
			{row.expiresSoon && (
				<p className="m-0">
					{row.token} expires {row.expires}.
				</p>
			)}
			{row.detail && <p className="m-0 break-words">{row.detail}</p>}
			{row.fix && (
				<p className="m-0 break-words text-eink-black">To fix: {row.fix}</p>
			)}
		</div>
	);
}
