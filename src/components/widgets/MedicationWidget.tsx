import { EinkCard } from "@/components/ui/EinkCard";
import { EinkIcon } from "@/components/ui/EinkIcon";

interface MedicationWidgetProps {
	medications: Array<{
		name: string;
		dosage?: string;
		time?: string;
		notes?: string;
	}>;
	size?: "small" | "medium";
}

export function MedicationWidget({
	medications,
	size = "small",
}: MedicationWidgetProps) {
	return (
		<EinkCard
			title="Medication"
			icon={<EinkIcon name="pill" size="sm" />}
			size={size}
		>
			<div className="flex flex-col gap-2">
				{medications.length === 0 ? (
					<div className="text-eink-dark text-eink-sm">
						No medications scheduled
					</div>
				) : (
					medications.map((med, i) => (
						<div
							key={med.name}
							className={`
                flex items-center gap-2
                ${i < medications.length - 1 ? "pb-2 border-b border-eink-light" : ""}
              `}
						>
							<div className="flex-1 min-w-0">
								<div className="text-eink-sm font-medium">{med.name}</div>
								{med.dosage && (
									<div className="text-eink-xs text-eink-dark">
										{med.dosage}
									</div>
								)}
							</div>

							{med.time && (
								<div className="text-eink-sm font-bold shrink-0">
									{med.time}
								</div>
							)}
						</div>
					))
				)}
			</div>
		</EinkCard>
	);
}
