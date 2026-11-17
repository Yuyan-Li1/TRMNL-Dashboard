import type { ReactNode } from "react";

interface EinkGridProps {
	children: ReactNode;
	className?: string;
}

/**
 * Grid container for TRMNL dashboard (800x480)
 * Uses a 2-column layout with 10px gaps
 */
export function EinkGrid({ children, className = "" }: EinkGridProps) {
	return (
		<div
			className={`grid h-[480px] w-[800px] auto-rows-min grid-cols-2 gap-[10px] bg-eink-white p-[10px] ${className} `}
		>
			{children}
		</div>
	);
}

/**
 * Full-width row in the grid
 */
export function EinkGridFullRow({ children }: { children: ReactNode }) {
	return <div className="col-span-2">{children}</div>;
}
