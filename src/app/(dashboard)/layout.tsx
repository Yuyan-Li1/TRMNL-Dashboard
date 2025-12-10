import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
	title: "TRMNL Dashboard",
	description: "Custom e-ink dashboard for TRMNL",
};

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			{/* TRMNL requires these for proper rendering */}
			<link
				rel="stylesheet"
				href="https://usetrmnl.com/css/latest/plugins.css"
			/>
			<Script
				src="https://usetrmnl.com/js/latest/plugins.js"
				strategy="afterInteractive"
			/>
			{children}
		</>
	);
}
