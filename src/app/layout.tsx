import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "TRMNL Dashboard",
	description: "Custom e-ink dashboard for TRMNL",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
