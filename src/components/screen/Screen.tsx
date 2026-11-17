import type { ScreenView } from "@/lib/screen/types";
import { MediumCard } from "./MediumCard";
import { Spotlight } from "./Spotlight";

/** The 800x480 screen: the Spotlight, and a rail of Medium cards. */
export function Screen({ view }: { view: ScreenView }): React.JSX.Element {
	const now = new Date(view.now);

	return (
		<div className="trmnl-container flex">
			{view.spotlight ? (
				<Spotlight spotlight={view.spotlight} />
			) : (
				<div className="flex w-[596px] flex-none items-center justify-center type-21">
					Nothing to show yet
				</div>
			)}

			<div className="flex w-[204px] flex-none flex-col border-l-2 border-eink-black">
				{view.cards.map((card) => (
					<MediumCard key={card.medium} card={card} now={now} />
				))}
			</div>
		</div>
	);
}
