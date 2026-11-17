import { formatWhen } from "@/lib/screen/games";
import { MEDIUM_NAMES, type MediumCardView } from "@/lib/screen/types";
import { PosterImage } from "./PosterImage";
import { Stars } from "./Stars";

/** The latest activity for one Medium, however old. */
export function MediumCard({
	card,
	now,
}: {
	card: MediumCardView;
	now: Date;
}): React.JSX.Element {
	const { activity } = card;

	return (
		<div className="flex min-h-0 flex-1 items-center gap-2.5 border-t-2 border-eink-black px-2.5 first:border-t-0">
			{activity?.thumbnail && (
				<div className="flex h-[96px] w-[64px] flex-none items-center justify-center">
					<PosterImage poster={activity.thumbnail} />
				</div>
			)}

			<div className="flex min-w-0 flex-col gap-1">
				<div className="type-12 font-bold text-eink-dark">
					{MEDIUM_NAMES[card.medium]}
				</div>
				{activity ? (
					<>
						<div className="line-clamp-2 type-16 leading-[18px] font-bold">
							{activity.title}
						</div>
						{activity.stars !== undefined && (
							<Stars value={activity.stars} size={14} />
						)}
						{activity.detail && (
							<div className="type-12">{activity.detail}</div>
						)}
						{activity.at && (
							<div className="type-12 text-eink-dark">
								{formatWhen(activity.at, now)}
							</div>
						)}
					</>
				) : (
					<div className="type-16">Nothing yet</div>
				)}
			</div>
		</div>
	);
}
