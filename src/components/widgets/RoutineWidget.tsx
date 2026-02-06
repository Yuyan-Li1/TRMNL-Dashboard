import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";

interface RoutineStep {
	title: string;
	description?: string;
	duration?: number;
	completed?: boolean;
}

interface RoutineWidgetProps {
	name: string;
	steps: RoutineStep[];
	size?: "small" | "medium" | "large";
	category?: "morning" | "evening" | "skincare" | "medication" | "custom";
}

const categoryIcons = {
	morning: "sun",
	evening: "clock",
	skincare: "check",
	medication: "pill",
	custom: "check",
};

export function RoutineWidget({
	name,
	steps,
	size = "medium",
	category = "custom",
}: RoutineWidgetProps) {
	const icon = categoryIcons[category];
	const displaySteps = size === "small" ? steps.slice(0, 3) : steps;

	return (
		<EinkCard
			title={name}
			icon={<EinkIcon name={icon} size="sm" />}
			size={size}
		>
			<div className="flex flex-col gap-1">
				{displaySteps.map((step, i) => (
					<div
						key={step.title}
						className={`
              flex items-start gap-2
              ${i < displaySteps.length - 1 ? "pb-1" : ""}
            `}
					>
						{/* Step number or checkbox */}
						<div
							className={`
                w-5 h-5 flex items-center justify-center shrink-0
                border-2 border-eink-black text-eink-xs font-bold
                ${step.completed ? "bg-eink-black text-eink-white" : ""}
              `}
						>
							{step.completed ? "X" : i + 1}
						</div>

						{/* Step content */}
						<div className="flex-1 min-w-0">
							<div
								className={`
                  text-eink-sm
                  ${step.completed ? "line-through text-eink-dark" : ""}
                `}
							>
								{step.title}
							</div>
							{step.description && size !== "small" && (
								<div className="text-eink-xs text-eink-dark truncate">
									{step.description}
								</div>
							)}
						</div>

						{/* Duration */}
						{step.duration && size !== "small" && (
							<div className="text-eink-xs text-eink-dark shrink-0">
								{step.duration}m
							</div>
						)}
					</div>
				))}

				{steps.length > displaySteps.length && (
					<div className="text-eink-xs text-eink-dark mt-1">
						+{steps.length - displaySteps.length} more steps
					</div>
				)}
			</div>
		</EinkCard>
	);
}
