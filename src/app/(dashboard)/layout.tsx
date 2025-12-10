import type { Metadata } from "next";
import "../globals.css";

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
		<html lang="en">
			<head>
				{/* TRMNL requires these for proper rendering */}
				<link
					rel="stylesheet"
					href="https://usetrmnl.com/css/latest/plugins.css"
				/>
				<script src="https://usetrmnl.com/js/latest/plugins.js" async />
			</head>
			<body className="m-0 p-0">{children}</body>
		</html>
	);
}
