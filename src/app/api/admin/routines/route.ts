import { type NextRequest, NextResponse } from "next/server";
import { Routine } from "@/lib/db/models/routine";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET() {
	await connectToDatabase();
	const routines = await Routine.find({}).sort({ category: 1, name: 1 });
	return NextResponse.json(routines);
}

export async function POST(request: NextRequest) {
	const body = await request.json();

	await connectToDatabase();
	const routine = await Routine.create(body);

	return NextResponse.json(routine, { status: 201 });
}
