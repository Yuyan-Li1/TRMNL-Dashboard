import { EinkIcon } from "@/components/ui/EinkIcon";
import type { SpecialCondition } from "@/types/schedule";

interface AlertBannerProps {
	conditions: SpecialCondition[];
}

const conditionIcons: Record<SpecialCondition["type"], string> = {
	rain_expected: "umbrella",
	train_delay: "alert",
	hot_day: "sun",
	cold_day: "cloud",
	meeting_soon: "calendar",
};

export function AlertBanner({ conditions }: AlertBannerProps) {
	if (conditions.length === 0) return null;

	// Only show high and medium severity
	const importantConditions = conditions.filter(
		(c) => c.severity === "high" || c.severity === "medium",
	);

	if (importantConditions.length === 0) return null;

	return (
		<div className="w-full bg-eink-black text-eink-white p-2 flex items-center gap-3">
			<EinkIcon name="alert" size="md" className="shrink-0" />
			<div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
				{importantConditions.map((condition) => (
					<div key={condition.type} className="flex items-center gap-1">
						<EinkIcon
							name={conditionIcons[condition.type]}
							size="sm"
							className="opacity-80"
						/>
						<span className="text-eink-sm">{condition.message}</span>
					</div>
				))}
			</div>
		</div>
	);
}
