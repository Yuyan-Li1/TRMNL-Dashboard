// PROTOTYPE, throwaway. For the ticket "Spotlight screen on 2-bit e-ink".
// Plan: three variants of the 800x480 media screen plus a device test card,
// switchable via ?variant=A|B|C|F|T, each across ten scenes via ?scene=1..10,
// on a throwaway route because the current dashboard page is being replaced.
// Artwork comes from: node scripts/prototype-spotlight-dither.mjs
import { headers } from "next/headers";
import type { ReactElement } from "react";
import { SCENES } from "./data";
import { PrototypeSwitcher } from "./PrototypeSwitcher";
import "./prototype.css";
import { VariantA, VariantB, VariantC, VariantT } from "./variants";

export const dynamic = "force-dynamic";

const VARIANTS = [
	{ key: "A", name: "Poster left, card rail" },
	{ key: "B", name: "Spotlight over shelf" },
	{ key: "C", name: "Black marquee, text list" },
	{ key: "F", name: "Layout A in TRMNL font" },
	{ key: "T", name: "Device test" },
];

export default async function SpotlightPrototypePage({
	searchParams,
}: {
	searchParams: Promise<{ variant?: string; scene?: string }>;
}): Promise<ReactElement> {
	const params = await searchParams;
	const variant = VARIANTS.some((v) => v.key === params.variant) ? (params.variant as string) : "A";
	const index = Math.min(SCENES.length, Math.max(1, Number(params.scene) || 1)) - 1;
	const scene = SCENES[index];

	const h = await headers();
	const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
	const base = `${h.get("x-forwarded-proto") ?? "http"}://${host}`;

	return (
		<div className="sp-page">
			<link
				rel="stylesheet"
				href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap"
			/>
			<div className="sp-frame">
				{variant === "A" && <VariantA scene={scene} base={base} />}
				{variant === "B" && <VariantB scene={scene} base={base} />}
				{variant === "C" && <VariantC scene={scene} base={base} />}
				{variant === "F" && (
					<div className="f-root">
						<VariantA scene={scene} base={base} />
					</div>
				)}
				{variant === "T" && <VariantT scene={scene} base={base} />}
			</div>
			<div className="sp-state">
				variant {variant} | scene {index + 1}: {scene.name}
				<br />
				title {scene.title.length} chars | reason {scene.reason?.length ?? 0} chars | text{" "}
				{scene.text?.length ?? 0} chars | rating{" "}
				{scene.rating ? `${scene.rating.whose} ${scene.rating.native}` : "none"}
				<br />
				Arrow keys: left/right variant, up/down scene. Activity, friends and review text are made up.
			</div>
			<PrototypeSwitcher
				variants={VARIANTS}
				variant={variant}
				scenes={SCENES.map((s) => s.name)}
				scene={index}
			/>
		</div>
	);
}
