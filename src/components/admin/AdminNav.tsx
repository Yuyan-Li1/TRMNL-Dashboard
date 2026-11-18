"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
	{ href: "/admin", label: "Overview" },
	{ href: "/admin/sources", label: "Sources" },
] as const;

/** The admin area's header. The login page stands alone, without it. */
export function AdminNav(): React.JSX.Element | null {
	const pathname = usePathname();
	if (pathname === "/admin/login") {
		return null;
	}

	return (
		<header className="border-b-2 border-eink-black">
			<nav
				aria-label="Admin"
				className="mx-auto flex max-w-[864px] flex-wrap items-end gap-x-8 gap-y-2 px-4 pt-5"
			>
				<Link href="/admin" className="pb-3 type-21 font-bold">
					TRMNL
				</Link>

				{PAGES.map(({ href, label }) => {
					const current = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							aria-current={current ? "page" : undefined}
							className={`-mb-0.5 border-b-[6px] pb-2 ${
								current
									? "border-eink-black font-bold"
									: "border-transparent text-eink-dark hover:border-eink-light hover:text-eink-black"
							}`}
						>
							{label}
						</Link>
					);
				})}

				<a href="/" target="_blank" className="admin-link mb-3 ml-auto">
					Open the dashboard
				</a>
			</nav>
		</header>
	);
}
