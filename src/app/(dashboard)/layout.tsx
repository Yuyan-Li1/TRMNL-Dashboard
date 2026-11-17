import type { Metadata, Viewport } from "next";
import { TrmnlFontFaces } from "@/components/ui/TrmnlFontFaces";
import { TRMNL } from "@/lib/config";

export const metadata: Metadata = {
	title: "TRMNL Dashboard",
	description: "Custom e-ink dashboard for TRMNL",
	robots: "noindex, nofollow",
};

export const viewport: Viewport = {
	width: TRMNL.width,
	height: TRMNL.height,
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<>
			<TrmnlFontFaces />
			{children}
		</>
	);
}
