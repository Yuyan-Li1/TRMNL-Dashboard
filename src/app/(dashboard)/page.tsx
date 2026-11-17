import { Screen } from "@/components/screen/Screen";
import { loadScreen } from "@/lib/screen/load";

// The Spotlight is re-picked on every render, so nothing here is cached
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
	return <Screen view={await loadScreen()} />;
}
