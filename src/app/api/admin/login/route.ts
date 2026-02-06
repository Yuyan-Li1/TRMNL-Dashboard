import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const ADMIN_TOKEN = process.env.CRON_SECRET;
	if (!ADMIN_TOKEN) {
		return NextResponse.json(
			{ error: "Server not configured" },
			{ status: 500 },
		);
	}

	const body = await request.json();
	const { token } = body as { token?: string };

	if (!token || token !== ADMIN_TOKEN) {
		return NextResponse.json({ error: "Invalid token" }, { status: 401 });
	}

	const response = NextResponse.json({ success: true });
	response.cookies.set("admin_token", token, {
		path: "/",
		httpOnly: true,
		sameSite: "strict",
		maxAge: 60 * 60 * 24 * 7, // 7 days
	});

	return response;
}
