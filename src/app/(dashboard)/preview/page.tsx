import { Screen } from "@/components/screen/Screen";
import { StatusStrip } from "@/components/status/StatusStrip";
import { loadStatusStrip } from "@/lib/health/strip";
import { loadScreen } from "@/lib/screen/load";

export const dynamic = "force-dynamic";

export default async function PreviewPage(): Promise<React.JSX.Element> {
	const [view, strip] = await Promise.all([
		loadScreen({ rememberPick: false }),
		loadStatusStrip(),
	]);

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
					<StatusStrip view={strip} />
				</div>
			</div>
		</div>
	);
}
