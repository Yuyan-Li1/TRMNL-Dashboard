import { GeistPixelSquare } from "geist/font/pixel";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { TrmnlFontFaces } from "@/components/ui/TrmnlFontFaces";

export const metadata: Metadata = {
	title: "TRMNL admin",
	description: "The admin area of the TRMNL dashboard",
};

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className={`admin ${GeistPixelSquare.variable}`}>
			<TrmnlFontFaces />
			<AdminNav />
			<main className="mx-auto max-w-[864px] px-4 pt-10 pb-16">{children}</main>
		</div>
	);
}
