import { MEDIUM_NAMES, type SpotlightView } from "@/lib/screen/types";
import { PosterImage } from "./PosterImage";
import { Stars } from "./Stars";

/** The Spotlight: the poster on the left edge and the text column beside it. */
export function Spotlight({
	spotlight,
}: {
	spotlight: SpotlightView;
}): React.JSX.Element {
	return (
		<>
			{/* The poster keeps its own shape, so it may be shorter than the slot. */}
			<div
				className={`flex h-[480px] w-[320px] flex-none items-center justify-center ${
					spotlight.poster ? "bg-eink-white" : "bg-eink-light"
				}`}
			>
				{spotlight.poster && <PosterImage poster={spotlight.poster} />}
			</div>

			<div className="flex w-[276px] flex-none flex-col gap-2.5 pt-[18px] pr-[18px] pb-3.5 pl-5">
				<div className="flex items-center gap-2 type-16 font-bold">
					<span className="bg-eink-black px-[9px] py-[3px] text-eink-white">
						{spotlight.mode}
					</span>
					<span>{MEDIUM_NAMES[spotlight.medium]}</span>
				</div>

				<h1 className="line-clamp-3 type-title">{spotlight.title}</h1>

				<div className="-mt-1 type-16 text-eink-dark">{spotlight.byline}</div>

				{spotlight.rating && (
					<div className="flex items-center gap-2 type-16 font-bold">
						<Stars value={spotlight.rating.stars} />
						<span>{spotlight.rating.whose}</span>
					</div>
				)}

				{spotlight.reason && (
					<div className="border-l-4 border-eink-black pl-2 type-16 font-bold">
						{spotlight.reason}
					</div>
				)}

				{spotlight.facts.length > 0 && (
					<div className="flex flex-col gap-[5px] type-21">
						{spotlight.facts.map((fact) => (
							<div key={fact}>{fact}</div>
						))}
					</div>
				)}

				{spotlight.progress !== undefined && (
					<div className="h-2.5 flex-none border-2 border-eink-black">
						<div
							className="h-full bg-eink-black"
							style={{ width: `${Math.round(spotlight.progress * 100)}%` }}
						/>
					</div>
				)}

				{spotlight.text && (
					<div className="min-h-0 flex-1">
						<p className="spotlight-text type-16">{spotlight.text}</p>
					</div>
				)}
			</div>
		</>
	);
}
