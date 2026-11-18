/**
 * The attribution Trakt's API policy asks for. Like TMDB's, it sits below
 * the 800x480 area the device captures.
 */
export function TraktAttribution(): React.JSX.Element {
	return (
		<footer className="w-[800px] px-5 pb-4 text-sm text-eink-dark">
			This product uses Trakt but is not endorsed or certified by Trakt.
		</footer>
	);
}
