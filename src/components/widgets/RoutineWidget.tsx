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
				{displaySteps.length === 0 && (
					<div className="text-eink-sm text-eink-dark">
						No routine scheduled
					</div>
				)}
				{displaySteps.map((step, i) => (
					<div
						key={step.title}
						className={`flex items-start gap-2 ${i < displaySteps.length - 1 ? "pb-1" : ""} `}
					>
						{/* Step number or checkbox */}
						<div
							className={`text-eink-xs flex h-5 w-5 shrink-0 items-center justify-center border-2 border-eink-black font-bold ${step.completed ? "bg-eink-black text-eink-white" : ""} `}
						>
							{step.completed ? "X" : i + 1}
						</div>

						{/* Step content */}
						<div className="min-w-0 flex-1">
							<div
								className={`text-eink-sm ${step.completed ? "text-eink-dark line-through" : ""} `}
							>
								{step.title}
							</div>
							{step.description && size !== "small" && (
								<div className="text-eink-xs truncate text-eink-dark">
									{step.description}
								</div>
							)}
						</div>

						{/* Duration */}
						{step.duration && size !== "small" && (
							<div className="text-eink-xs shrink-0 text-eink-dark">
								{step.duration}m
							</div>
						)}
					</div>
				))}

				{steps.length > displaySteps.length && (
					<div className="text-eink-xs mt-1 text-eink-dark">
						+{steps.length - displaySteps.length} more steps
					</div>
				)}
			</div>
		</EinkCard>
	);
}
