import { Screen } from "@/components/screen/Screen";
import { StatusStrip } from "@/components/status/StatusStrip";
import { loadStatusStrip } from "@/lib/health/strip";
import { loadScreen } from "@/lib/screen/load";

// The Spotlight is re-picked on every render, so nothing here is cached
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage(): Promise<React.JSX.Element> {
	const [view, strip] = await Promise.all([loadScreen(), loadStatusStrip()]);

	return (
		<>
			<Screen view={view} />
			<StatusStrip view={strip} />
		</>
	);
}
