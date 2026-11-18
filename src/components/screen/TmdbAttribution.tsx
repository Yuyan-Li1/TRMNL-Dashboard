import { getBaseUrl } from "@/lib/base-url";

/**
 * The attribution TMDB's terms require. It sits below the 800x480 area the
 * device captures, so it is on the page without being on the panel.
 */
export function TmdbAttribution(): React.JSX.Element {
	return (
		<footer className="flex w-[800px] items-center gap-3 px-5 py-4 text-sm text-eink-dark">
			<img
				src={`${getBaseUrl()}/tmdb-logo.svg`}
				width={92}
				height={12}
				alt="TMDB"
				className="flex-none"
			/>
			<span>
				This product uses the TMDB API but is not endorsed or certified by TMDB.
			</span>
		</footer>
	);
}
