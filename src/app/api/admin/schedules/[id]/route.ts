import { type NextRequest, NextResponse } from "next/server";
import { Schedule } from "@/lib/db/models/schedule";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	await connectToDatabase();
	const schedule = await Schedule.findById(id);

	if (!schedule) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(schedule);
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const body = await request.json();

	await connectToDatabase();
	const schedule = await Schedule.findByIdAndUpdate(id, body, {
		new: true,
	});

	if (!schedule) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(schedule);
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	await connectToDatabase();
	await Schedule.findByIdAndDelete(id);

	return NextResponse.json({ success: true });
}
