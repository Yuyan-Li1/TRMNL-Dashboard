import { type NextRequest, NextResponse } from "next/server";
import { Schedule } from "@/lib/db/models/schedule";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function GET() {
	await connectToDatabase();
	const schedules = await Schedule.find({}).sort({ dayType: 1 });
	return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
	const body = await request.json();

	await connectToDatabase();
	const schedule = await Schedule.create(body);

	return NextResponse.json(schedule, { status: 201 });
}
