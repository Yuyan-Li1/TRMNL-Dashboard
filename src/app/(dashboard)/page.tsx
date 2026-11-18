import { Screen } from "@/components/screen/Screen";
import { TmdbAttribution } from "@/components/screen/TmdbAttribution";
import { TraktAttribution } from "@/components/screen/TraktAttribution";
import { loadScreen } from "@/lib/screen/load";

// The Spotlight is re-picked on every render, so nothing here is cached
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage(): Promise<React.JSX.Element> {
	return (
		<>
			<Screen view={await loadScreen()} />
			<TmdbAttribution />
			<TraktAttribution />
		</>
	);
}
