import type { ReactNode } from "react";

interface EinkCardProps {
	children: ReactNode;
	title?: string;
	icon?: ReactNode;
	size?: "small" | "medium" | "large" | "full";
	variant?: "default" | "outlined" | "filled";
	className?: string;
}

const sizeClasses = {
	small: "",
	medium: "",
	large: "",
	full: "",
};

const variantClasses = {
	default: "border-2 border-eink-black bg-eink-white",
	outlined: "border-2 border-eink-dark bg-eink-white",
	filled: "border-2 border-eink-black bg-eink-light",
};

export function EinkCard({
	children,
	title,
	icon,
	size = "medium",
	variant = "default",
	className = "",
}: EinkCardProps) {
	return (
		<div
			className={` ${sizeClasses[size]} ${variantClasses[variant]} flex h-full flex-col overflow-hidden p-3 ${className} `}
		>
			{(title || icon) && (
				<div className="mb-2 flex shrink-0 items-center gap-2 border-b-2 border-eink-dark pb-2">
					{icon && <span className="text-eink-black">{icon}</span>}
					{title && (
						<h3 className="type-16 font-bold tracking-wide text-eink-black uppercase">
							{title}
						</h3>
					)}
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
		</div>
	);
}
