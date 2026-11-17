"use client";

// PROTOTYPE, throwaway. Floating bar: left/right cycles the variant,
// up/down cycles the scene. Sits outside the 800x480 frame.
import { useRouter } from "next/navigation";
import { type ReactElement, useEffect } from "react";

interface Props {
	variants: { key: string; name: string }[];
	variant: string;
	scenes: string[];
	scene: number;
}

export function PrototypeSwitcher({ variants, variant, scenes, scene }: Props): ReactElement | null {
	const router = useRouter();
	const vi = Math.max(
		0,
		variants.findIndex((v) => v.key === variant),
	);

	function go(nextVariant: number, nextScene: number): void {
		const v = variants[(nextVariant + variants.length) % variants.length].key;
		const s = (nextScene + scenes.length) % scenes.length;
		router.replace(`?variant=${v}&scene=${s + 1}`, { scroll: false });
	}

	useEffect(() => {
		function onKey(e: KeyboardEvent): void {
			const el = e.target as HTMLElement | null;
			if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
			if (e.key === "ArrowLeft") go(vi - 1, scene);
			else if (e.key === "ArrowRight") go(vi + 1, scene);
			else if (e.key === "ArrowUp") go(vi, scene - 1);
			else if (e.key === "ArrowDown") go(vi, scene + 1);
			else return;
			e.preventDefault();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (process.env.NODE_ENV === "production") return null;

	return (
		<div className="sp-switch">
			<button type="button" aria-label="Previous variant" onClick={() => go(vi - 1, scene)}>
				←
			</button>
			<span className="lbl">
				{variants[vi].key} ({variants[vi].name})
			</span>
			<button type="button" aria-label="Next variant" onClick={() => go(vi + 1, scene)}>
				→
			</button>
			<span className="sep" />
			<button type="button" aria-label="Previous scene" onClick={() => go(vi, scene - 1)}>
				↑
			</button>
			<span className="lbl" style={{ minWidth: 300 }}>
				{scene + 1}/{scenes.length} {scenes[scene]}
			</span>
			<button type="button" aria-label="Next scene" onClick={() => go(vi, scene + 1)}>
				↓
			</button>
		</div>
	);
}
