import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	// Only protect admin routes
	const isAdminRoute =
		request.nextUrl.pathname.startsWith("/admin") ||
		request.nextUrl.pathname.startsWith("/api/admin");

	if (!isAdminRoute) {
		return NextResponse.next();
	}

	// Allow access to the login page and login API
	if (
		request.nextUrl.pathname === "/admin/login" ||
		request.nextUrl.pathname === "/api/admin/login"
	) {
		return NextResponse.next();
	}

	const ADMIN_TOKEN = process.env.CRON_SECRET;
	if (!ADMIN_TOKEN) {
		return NextResponse.json(
			{ error: "Server not configured" },
			{ status: 500 },
		);
	}

	// Check Authorization header
	const authHeader = request.headers.get("Authorization");
	if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
		return NextResponse.next();
	}

	// Check cookie (for browser sessions)
	const tokenCookie = request.cookies.get("admin_token");
	const cookieValue = tokenCookie?.value
		? decodeURIComponent(tokenCookie.value)
		: null;
	if (cookieValue === ADMIN_TOKEN) {
		return NextResponse.next();
	}

	// For browser requests to /admin pages, redirect to login
	if (!request.nextUrl.pathname.startsWith("/api/")) {
		return NextResponse.redirect(new URL("/admin/login", request.url));
	}

	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
	matcher: ["/admin/:path*", "/api/admin/:path*"],
};
