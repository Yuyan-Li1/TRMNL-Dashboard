import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "TRMNL Admin",
	description: "Admin dashboard for TRMNL",
};

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			{/* Navigation */}
			<nav className="bg-white border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex">
							<Link
								href="/admin"
								className="flex items-center px-2 text-xl font-bold text-gray-900"
							>
								TRMNL Admin
							</Link>

							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								<NavLink href="/admin">Dashboard</NavLink>
								<NavLink href="/admin/schedules">Schedules</NavLink>
								<NavLink href="/admin/routines">Routines</NavLink>
								<NavLink href="/admin/tokens">Tokens</NavLink>
							</div>
						</div>

						<div className="flex items-center">
							<Link
								href="/"
								target="_blank"
								className="text-sm text-gray-500 hover:text-gray-900"
							>
								View Dashboard
							</Link>
						</div>
					</div>
				</div>
			</nav>

			{/* Main content */}
			<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
		</>
	);
}

function NavLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
		>
			{children}
		</Link>
	);
}
