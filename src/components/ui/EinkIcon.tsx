import type { JSX } from "react";

interface EinkIconProps {
	name: string;
	size?: "sm" | "md" | "lg" | "xl";
	className?: string;
}

const sizeMap = {
	sm: 16,
	md: 24,
	lg: 32,
	xl: 48,
};

// Simple SVG icons optimized for e-ink (2px minimum stroke)
const icons: Record<string, (size: number) => JSX.Element> = {
	sun: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
		</svg>
	),
	cloud: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
		</svg>
	),
	"cloud-rain": (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
		</svg>
	),
	train: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<rect x="4" y="3" width="16" height="16" rx="2" />
			<path d="M4 11h16M12 3v8M8 19l-2 3M16 19l2 3" />
			<circle cx="8" cy="15" r="1" fill="currentColor" />
			<circle cx="16" cy="15" r="1" fill="currentColor" />
		</svg>
	),
	calendar: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<rect x="3" y="4" width="18" height="18" rx="2" />
			<path d="M16 2v4M8 2v4M3 10h18" />
		</svg>
	),
	gamepad: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 20 20"
			fill="currentColor"
			aria-hidden="true"
		>
			<g transform="translate(-124, -4559)">
				<path d="M142,4570 C142,4569.448 141.552,4569 141,4569 L127,4569 C126.448,4569 126,4569.448 126,4570 L126,4576 C126,4576.552 126.448,4577 127,4577 L141,4577 C141.552,4577 142,4576.552 142,4576 L142,4570 Z M144,4569 L144,4577 C144,4578.105 143.105,4579 142,4579 L126,4579 C124.895,4579 124,4578.105 124,4577 L124,4569 C124,4567.895 124.895,4567 126,4567 L133,4567 L133,4563 C133,4561.895 133.895,4561 135,4561 L137,4561 C137.552,4561 138,4560.552 138,4560 L138,4559 L140,4559 L140,4561 C140,4562.105 139.105,4563 138,4563 L136,4563 C135.448,4563 135,4563.448 135,4564 L135,4567 L142,4567 C143.105,4567 144,4567.895 144,4569 L144,4569 Z M138,4574 L140,4574 L140,4572 L138,4572 L138,4574 Z M135,4572 C134.448,4572 134,4572.448 134,4573 C134,4573.552 134.448,4574 135,4574 C135.552,4574 136,4573.552 136,4573 C136,4572.448 135.552,4572 135,4572 L135,4572 Z M131,4572 L132,4572 L132,4574 L131,4574 L131,4575 L129,4575 L129,4574 L128,4574 L128,4572 L129,4572 L129,4571 L131,4571 L131,4572 Z" />
			</g>
		</svg>
	),
	// Platform icons from SVG Repo
	steam: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 32 32"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M18.102 12.129c0-0 0-0 0-0.001 0-1.564 1.268-2.831 2.831-2.831s2.831 1.268 2.831 2.831c0 1.564-1.267 2.831-2.831 2.831-0 0-0 0-0.001 0h0c-0 0-0 0-0.001 0-1.563 0-2.83-1.267-2.83-2.83 0-0 0-0 0-0.001v0zM24.691 12.135c0-2.081-1.687-3.768-3.768-3.768s-3.768 1.687-3.768 3.768c0 2.081 1.687 3.768 3.768 3.768v0c2.080-0.003 3.765-1.688 3.768-3.767v-0zM10.427 23.76l-1.841-0.762c0.524 1.078 1.611 1.808 2.868 1.808 1.317 0 2.448-0.801 2.93-1.943l0.008-0.021c0.155-0.362 0.246-0.784 0.246-1.226 0-1.757-1.424-3.181-3.181-3.181-0.405 0-0.792 0.076-1.148 0.213l0.022-0.007 1.903 0.787c0.852 0.364 1.439 1.196 1.439 2.164 0 1.296-1.051 2.347-2.347 2.347-0.324 0-0.632-0.066-0.913-0.184l0.015 0.006zM15.974 1.004c-7.857 0.001-14.301 6.046-14.938 13.738l-0.004 0.054 8.038 3.322c0.668-0.462 1.495-0.737 2.387-0.737 0.001 0 0.002 0 0.002 0h-0c0.079 0 0.156 0.005 0.235 0.008l3.575-5.176v-0.074c0.003-3.12 2.533-5.648 5.653-5.648 3.122 0 5.653 2.531 5.653 5.653s-2.531 5.653-5.653 5.653h-0.131l-5.094 3.638c0 0.065 0.005 0.131 0.005 0.199 0 0.001 0 0.002 0 0.003 0 2.342-1.899 4.241-4.241 4.241-2.047 0-3.756-1.451-4.153-3.38l-0.005-0.027-5.755-2.383c1.841 6.345 7.601 10.905 14.425 10.905 8.281 0 14.994-6.713 14.994-14.994s-6.713-14.994-14.994-14.994c-0 0-0.001 0-0.001 0h0z" />
		</svg>
	),
	xbox: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
		>
			<path
				fillRule="nonzero"
				d="M5.418 19.527A9.956 9.956 0 0 0 12 22a9.967 9.967 0 0 0 6.585-2.473c1.564-1.593-3.597-7.257-6.585-9.514-2.985 2.257-8.15 7.921-6.582 9.514zm9.3-12.005c2.084 2.468 6.237 8.595 5.064 10.76A9.952 9.952 0 0 0 22 12.003a9.958 9.958 0 0 0-2.975-7.113s-.022-.018-.068-.035a.686.686 0 0 0-.235-.038c-.493 0-1.654.362-4.004 2.705zM5.045 4.856c-.048.017-.068.034-.072.035A9.963 9.963 0 0 0 2 12.003c0 2.379.832 4.561 2.218 6.278C3.05 16.11 7.2 9.988 9.284 7.523 6.934 5.178 5.771 4.818 5.28 4.818a.604.604 0 0 0-.234.039v-.002zM12 4.959S9.546 3.523 7.63 3.455c-.753-.027-1.212.246-1.268.282C8.149 2.538 10.049 2 11.987 2H12c1.945 0 3.838.538 5.638 1.737-.056-.038-.512-.31-1.266-.282-1.917.068-4.372 1.5-4.372 1.5v.004z"
			/>
		</svg>
	),
	playstation: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 76 76"
			fill="currentColor"
			aria-hidden="true"
		>
			<path
				fillRule="evenodd"
				d="M 32.2238,48.7456C 32.2238,48.7456 30.4425,49.666 26.4693,49.6195C 22.4962,49.5731 18.9795,48.4711 19.0251,46.0771C 19.0703,43.6831 25.6017,41.0569 32.1778,39.9549L 32.1778,43.3158L 25.1904,45.1567C 25.1904,45.1567 23.9943,46.6767 25.6017,46.7189C 29.2547,46.8244 32.269,45.8449 32.269,45.8449M 40.9921,48.9778L 40.9921,52.1529C 40.9921,52.1529 54.6472,47.7322 56.6565,46.0306C 58.6663,44.3249 51.9525,40.09 48.3451,40.9218C 48.3451,40.9218 44.5117,41.1076 41.0377,42.6233L 41.0377,45.4776L 49.852,43.4044L 52.957,44.7893M 39.4847,52.706L 33.6851,50.2191L 33.6851,23.1504C 33.6851,23.1504 46.2897,25.27 48.025,30.514C 49.7608,35.7622 47.056,39.1654 46.1077,39.2625C 43.4579,39.5411 42.4534,37.8818 42.4534,37.8818L 42.4534,29.412L 39.5764,28.2129L 39.4847,52.706 Z"
			/>
		</svg>
	),
	check: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			aria-hidden="true"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	),
	alert: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	),
	umbrella: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<path d="M12 2v20M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12" />
		</svg>
	),
	clock: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	),
	pill: (s) => (
		<svg
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			aria-hidden="true"
		>
			<path d="M10.5 3.5a5 5 0 0 1 7.07 0l3.93 3.93a5 5 0 0 1 0 7.07l-7.07 7.07a5 5 0 0 1-7.07 0l-3.93-3.93a5 5 0 0 1 0-7.07z" />
			<line x1="7.5" y1="16.5" x2="16.5" y2="7.5" />
		</svg>
	),
};

export function EinkIcon({ name, size = "md", className = "" }: EinkIconProps) {
	const iconSize = sizeMap[size];
	const IconComponent = icons[name];

	if (!IconComponent) {
		// Fallback: empty box
		return (
			<div
				className={`border-2 border-current ${className}`}
				style={{ width: iconSize, height: iconSize }}
			/>
		);
	}

	return (
		<span className={className} role="img" aria-hidden="true">
			{IconComponent(iconSize)}
		</span>
	);
}
