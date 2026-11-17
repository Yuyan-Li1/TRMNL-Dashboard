import { GamingWidget } from "@/components/widgets/GamingWidget";
import type { DashboardRenderData } from "@/lib/dashboard/loader";

interface DashboardScreenProps {
	data: DashboardRenderData;
}

export function DashboardScreen({ data }: DashboardScreenProps) {
	return (
		<div className="trmnl-container bg-eink-white p-2">
			<GamingWidget data={data.gaming} size="large" limit={8} />
		</div>
	);
}
