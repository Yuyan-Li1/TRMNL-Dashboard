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
			className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        p-3 overflow-hidden h-full flex flex-col
        ${className}
      `}
		>
			{(title || icon) && (
				<div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-eink-dark shrink-0">
					{icon && <span className="text-eink-black">{icon}</span>}
					{title && (
						<h3 className="text-eink-sm font-bold text-eink-black uppercase tracking-wide">
							{title}
						</h3>
					)}
				</div>
			)}
			<div className="flex-1 min-h-0 overflow-hidden">{children}</div>
		</div>
	);
}
