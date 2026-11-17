// PROTOTYPE, throwaway. Three structurally different takes on the Spotlight
// screen, plus a device test card. See page.tsx for the plan.
import type { ReactElement } from "react";
import THUMBS from "./thumbs.json";
import { LATEST, type Latest, MEDIUM_LABEL, type Scene } from "./data";

interface Props {
	scene: Scene;
	base: string; // absolute origin, TRMNL needs absolute image URLs
}

function art(base: string, slug: string, size: "full" | "mid" | "thumb"): string {
	return `${base}/prototype/spotlight/${slug}-${size}.png`;
}

function Poster({ base, slug, size }: { base: string; slug: string; size: "full" | "mid" | "thumb" }): ReactElement {
	if (size === "thumb") {
		// Thumbnails keep the artwork's own aspect ratio, centred in a 64x96 slot.
		const [w, h] = (THUMBS as Record<string, number[]>)[slug] ?? [64, 96];
		return (
			<div style={{ flex: "none", width: 64, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<img src={art(base, slug, size)} width={w} height={h} alt="" loading="eager" />
			</div>
		);
	}
	const [w, h] = size === "full" ? [320, 480] : [224, 336];
	return <img src={art(base, slug, size)} width={w} height={h} alt="" loading="eager" style={{ flex: "none" }} />;
}

function others(scene: Scene): Latest[] {
	return LATEST.filter((l) => l.medium !== scene.medium);
}

const STAR = "M10 1.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L1.4 7.9l6-.8z";

function Stars({ value, size = 20 }: { value: number; size?: number }): ReactElement {
	return (
		<span className="sp-stars">
			{[0, 1, 2, 3, 4].map((i) => {
				const fill = Math.max(0, Math.min(1, value - i));
				return (
					<svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
						<clipPath id={`sp-h${i}-${size}-${fill}`}>
							<rect x="0" y="0" width={20 * fill} height="20" />
						</clipPath>
						<path d={STAR} fill="currentColor" clipPath={`url(#sp-h${i}-${size}-${fill})`} />
						<path d={STAR} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
					</svg>
				);
			})}
		</span>
	);
}

function Blocks({ value }: { value: number }): ReactElement {
	return (
		<span className="sp-blocks">
			{[0, 1, 2, 3, 4].map((i) => {
				const fill = Math.max(0, Math.min(1, value - i));
				return (
					<div key={i}>
						<div style={{ right: `${(1 - fill) * 100}%` }} />
					</div>
				);
			})}
		</span>
	);
}

function Bar({ value }: { value: number }): ReactElement {
	return (
		<div className="sp-bar">
			<div style={{ width: `${Math.round(value * 100)}%` }} />
		</div>
	);
}

/* A: full-height poster on the left edge, text column, Medium cards with
   thumbnails stacked in a rail. Ratings as stars. */
export function VariantA({ scene, base }: Props): ReactElement {
	return (
		<div className="a-root">
			<Poster base={base} slug={scene.art} size="full" />
			<div className="a-main">
				<div className="a-mode">
					<span>{scene.mode}</span>
					<span>{MEDIUM_LABEL[scene.medium]}</span>
				</div>
				<div className="a-title sp-clamp">{scene.title}</div>
				<div className="a-by">{scene.byline}</div>
				{scene.rating && (
					<div className="a-rating">
						<Stars value={scene.rating.stars} />
						<span>{scene.rating.whose}</span>
					</div>
				)}
				{scene.reason && <div className="a-reason">{scene.reason}</div>}
				{scene.facts.length > 0 && (
					<div className="a-facts">
						{scene.facts.map((f) => (
							<div key={f}>{f}</div>
						))}
					</div>
				)}
				{scene.progress !== undefined && <Bar value={scene.progress} />}
				{scene.text && <div className="a-text">{scene.text}</div>}
			</div>
			<div className="a-rail">
				{others(scene).map((l) => (
					<div className="a-card" key={l.medium}>
						<Poster base={base} slug={l.art} size="thumb" />
						<div style={{ minWidth: 0 }}>
							<div className="m">{MEDIUM_LABEL[l.medium]}</div>
							<div className="t sp-clamp">{l.title}</div>
							{l.stars !== undefined && <Stars value={l.stars} size={14} />}
							<div className="d">{l.detail}</div>
							<div className="d" style={{ color: "#555" }}>
								{l.when}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

/* B: Spotlight across the top with a smaller poster and a wide serif text
   area, Medium cards on a shelf along the bottom. Ratings as a boxed number
   in the source's own scale. */
export function VariantB({ scene, base }: Props): ReactElement {
	return (
		<>
			<div className="b-top">
				<Poster base={base} slug={scene.art} size="mid" />
				<div className="b-main">
					<div className="b-head">
						<span>
							{scene.mode}, {MEDIUM_LABEL[scene.medium].toLowerCase()}
						</span>
						<span>{scene.byline}</span>
					</div>
					<div className="b-title sp-clamp">{scene.title}</div>
					<div className="b-row">
						{scene.rating && (
							<div className="b-score">
								<b>{scene.rating.native.split(" / ")[0]}</b>
								<span>
									{scene.rating.whose === "You" ? "Your rating" : scene.rating.whose} out of{" "}
									{scene.rating.native.split(" / ")[1]}
								</span>
							</div>
						)}
						<div className="b-body">
							{scene.reason && <div className="b-reason">{scene.reason}</div>}
							{scene.facts.length > 0 && (
								<div className="b-facts">
									{scene.facts.map((f) => (
										<div key={f}>{f}</div>
									))}
								</div>
							)}
							{scene.progress !== undefined && (
								<div style={{ width: 260, marginTop: 8 }}>
									<Bar value={scene.progress} />
								</div>
							)}
							{scene.text && (
								<div className="b-text" style={{ marginTop: scene.facts.length ? 8 : 0 }}>
									{scene.text}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
			<div className="b-shelf">
				{others(scene).map((l) => (
					<div className="b-card" key={l.medium}>
						<Poster base={base} slug={l.art} size="thumb" />
						<div style={{ minWidth: 0 }}>
							<div className="m">{MEDIUM_LABEL[l.medium]}</div>
							<div className="t sp-clamp">{l.title}</div>
							<div className="d">
								{l.stars !== undefined ? `Rated ${l.stars}, ${l.when}` : l.detail}
							</div>
							{l.stars === undefined && (
								<div className="d" style={{ color: "#555" }}>
									{l.when}
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		</>
	);
}

/* C: black text panel led by a sentence ("Mina watched"), huge condensed
   title, full-height poster on the right, Medium cards reduced to three
   text-only lines. Ratings as blocks. */
export function VariantC({ scene, base }: Props): ReactElement {
	return (
		<div className="c-root">
			<div className="c-main">
				<div className="c-lead">{scene.lead}</div>
				<div className="c-title sp-clamp">{scene.title}</div>
				<div className="c-by">{scene.byline}</div>
				<div className="c-mid">
					{scene.rating && (
						<div className="c-rating">
							<Blocks value={scene.rating.stars} />
							<span>
								{scene.rating.whose === "You" ? "Your rating" : `${scene.rating.whose} ${scene.rating.native}`}
							</span>
						</div>
					)}
					{scene.reason && <div className="c-reason">{scene.reason}</div>}
					{scene.facts.length > 0 && (
						<div className="c-facts">
							{scene.facts.map((f) => (
								<div key={f}>{f}</div>
							))}
						</div>
					)}
					{scene.progress !== undefined && (
						<div style={{ width: 300 }}>
							<Bar value={scene.progress} />
						</div>
					)}
					{scene.text && <div className="c-text">{scene.text}</div>}
				</div>
				<div className="c-list">
					{others(scene).map((l) => (
						<div className="c-line" key={l.medium}>
							<span className="m">{MEDIUM_LABEL[l.medium]}</span>
							<span className="t">{l.title}</span>
							<span className="d">
								{l.stars !== undefined ? `${l.stars} stars, ` : `${l.detail}, `}
								{l.when}
							</span>
						</div>
					))}
				</div>
			</div>
			<Poster base={base} slug={scene.art} size="full" />
		</div>
	);
}

/* T: the on-device test from the TRMNL image rendering research. */
export function VariantT({ base }: Props): ReactElement {
	const dir = `${base}/prototype/spotlight`;
	const items: [string, string][] = [
		["Untouched colour JPEG", `${dir}/test-colour.jpg`],
		["Our dithered 4-grey PNG", `${dir}/severance-mid.png`],
		["Posterised, no dither", `${dir}/test-posterised.png`],
	];
	return (
		<div className="t-root">
			{items.map(([label, src]) => (
				<div key={label}>
					<img src={src} width={224} height={336} alt="" loading="eager" />
					<div style={{ marginTop: 8 }}>{label}</div>
				</div>
			))}
			<div className="t-sw">
				{["#000", "#555", "#aaa", "#fff"].map((c) => (
					<div key={c} style={{ background: c }} />
				))}
				<span>Four greys</span>
			</div>
		</div>
	);
}

/* P: poster tuning test. Four preparations of one poster, for the device. */
export function VariantP({ scene, base }: Props): ReactElement {
	const slug = ["perfect-days", "dune-2", "silksong", "piranesi"].includes(scene.art) ? scene.art : "perfect-days";
	const labels = ["1 First test", "2 Adaptive gamma", "3 Panel levels", "4 Local contrast, gamma, panel levels"];
	return (
		<div className="p-root">
			{labels.map((label, i) => (
				<div key={label}>
					<img src={`${base}/prototype/spotlight/${slug}-tune${i + 1}.png`} width={188} height={282} alt="" loading="eager" />
					<div>{label}</div>
				</div>
			))}
		</div>
	);
}
