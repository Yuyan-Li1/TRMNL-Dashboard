import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
	title: "TRMNL Dashboard",
	description: "Custom e-ink dashboard for TRMNL",
	robots: "noindex, nofollow",
};

export const viewport: Viewport = {
	width: 800,
	height: 480,
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
