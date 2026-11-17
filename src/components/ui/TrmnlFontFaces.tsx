import { getBaseUrl } from "@/lib/base-url";

const FAMILIES = ["TRMNL12", "TRMNL16", "TRMNL21"] as const;
const WEIGHTS = [
	{ file: "Regular", weight: "normal" },
	{ file: "Bold", weight: "bold" },
] as const;

/**
 * @font-face rules for the self-hosted TRMNL pixel fonts, with absolute URLs.
 * The fonts are SIL OFL 1.1; see public/fonts/trmnl/OFL.txt.
 */
export function TrmnlFontFaces(): React.JSX.Element {
	const base = getBaseUrl();
	const css = FAMILIES.flatMap((family) =>
		WEIGHTS.map(
			({ file, weight }) =>
				`@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url("${base}/fonts/trmnl/${family}-${file}.woff2") format("woff2");}`,
		),
	).join("");

	return <style>{css}</style>;
}
