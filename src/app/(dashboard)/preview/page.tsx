import { Screen } from "@/components/screen/Screen";
import { TmdbAttribution } from "@/components/screen/TmdbAttribution";
import { TraktAttribution } from "@/components/screen/TraktAttribution";
import { loadScreen } from "@/lib/screen/load";

export const dynamic = "force-dynamic";

export default async function PreviewPage(): Promise<React.JSX.Element> {
	const view = await loadScreen({ rememberPick: false });

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-800 p-8">
			<div className="relative">
				<div className="absolute -top-8 left-0 text-sm text-white">
					TRMNL Preview -- 800x480
				</div>

				<div className="rounded-lg bg-gray-900 p-4 shadow-2xl">
					<Screen view={view} />
				</div>

				<div className="mt-4 bg-eink-white">
					<TmdbAttribution />
					<TraktAttribution />
				</div>
			</div>
		</div>
	);
}
