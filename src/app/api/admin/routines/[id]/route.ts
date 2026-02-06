import { type NextRequest, NextResponse } from "next/server";
import { Routine } from "@/lib/db/models/routine";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	await connectToDatabase();
	const routine = await Routine.findById(id);

	if (!routine) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(routine);
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const body = await request.json();

	await connectToDatabase();
	const routine = await Routine.findByIdAndUpdate(id, body, {
		new: true,
	});

	if (!routine) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(routine);
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	await connectToDatabase();
	await Routine.findByIdAndDelete(id);

	return NextResponse.json({ success: true });
}
