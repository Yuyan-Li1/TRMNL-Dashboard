import { config } from "dotenv";

config({ path: ".env.local" });

import mongoose from "mongoose";
import { Routine } from "./models/routine";
import { Schedule } from "./models/schedule";
import { TokenHealth } from "./models/token";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
	throw new Error("MONGODB_URI not set");
}

async function seed() {
	console.log("Connecting to MongoDB...");
	await mongoose.connect(MONGODB_URI as string);

	console.log("Clearing existing data...");
	await Schedule.deleteMany({});
	await Routine.deleteMany({});
	await TokenHealth.deleteMany({});

	console.log("Creating default schedules...");

	// Office days: Tuesday, Thursday
	await Schedule.create({
		name: "Office Days",
		dayType: "office",
		daysOfWeek: [2, 4], // Tue, Thu
		timeBlocks: [
			{
				name: "morning",
				startTime: "06:00",
				endTime: "09:00",
				widgets: [
					{
						type: "routine",
						priority: 1,
						enabled: true,
						config: { category: "morning" },
					},
					{ type: "weather", priority: 2, enabled: true },
					{ type: "transit", priority: 3, enabled: true },
				],
			},
			{
				name: "workday",
				startTime: "09:00",
				endTime: "18:00",
				widgets: [
					{ type: "calendar", priority: 1, enabled: true },
					{ type: "weather", priority: 2, enabled: true },
				],
			},
			{
				name: "evening",
				startTime: "18:00",
				endTime: "22:00",
				widgets: [
					{
						type: "routine",
						priority: 1,
						enabled: true,
						config: { category: "skincare" },
					},
					{ type: "weather", priority: 2, enabled: true },
				],
			},
			{
				name: "night",
				startTime: "22:00",
				endTime: "06:00",
				widgets: [{ type: "weather", priority: 1, enabled: true }],
			},
		],
		isActive: true,
	});

	// WFH days: Monday, Wednesday, Friday
	await Schedule.create({
		name: "Work From Home",
		dayType: "wfh",
		daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
		timeBlocks: [
			{
				name: "morning",
				startTime: "07:00",
				endTime: "09:00",
				widgets: [
					{ type: "weather", priority: 1, enabled: true },
					{ type: "calendar", priority: 2, enabled: true },
				],
			},
			{
				name: "workday",
				startTime: "09:00",
				endTime: "18:00",
				widgets: [
					{ type: "medication", priority: 1, enabled: true },
					{ type: "calendar", priority: 2, enabled: true },
				],
			},
			{
				name: "evening",
				startTime: "18:00",
				endTime: "22:00",
				widgets: [
					{
						type: "routine",
						priority: 1,
						enabled: true,
						config: { category: "skincare" },
					},
					{ type: "gaming", priority: 2, enabled: true },
				],
			},
			{
				name: "night",
				startTime: "22:00",
				endTime: "07:00",
				widgets: [{ type: "weather", priority: 1, enabled: true }],
			},
		],
		isActive: true,
	});

	// Weekend: Saturday, Sunday
	await Schedule.create({
		name: "Weekend",
		dayType: "weekend",
		daysOfWeek: [0, 6], // Sun, Sat
		timeBlocks: [
			{
				name: "morning",
				startTime: "08:00",
				endTime: "12:00",
				widgets: [
					{ type: "weather", priority: 1, enabled: true },
					{ type: "gaming", priority: 2, enabled: true },
				],
			},
			{
				name: "workday", // Daytime on weekends
				startTime: "12:00",
				endTime: "18:00",
				widgets: [
					{ type: "weather", priority: 1, enabled: true },
					{ type: "gaming", priority: 2, enabled: true },
				],
			},
			{
				name: "evening",
				startTime: "18:00",
				endTime: "23:00",
				widgets: [
					{ type: "gaming", priority: 1, enabled: true },
					{
						type: "routine",
						priority: 2,
						enabled: true,
						config: { category: "skincare" },
					},
				],
			},
			{
				name: "night",
				startTime: "23:00",
				endTime: "08:00",
				widgets: [{ type: "weather", priority: 1, enabled: true }],
			},
		],
		isActive: true,
	});

	console.log("Creating default routines...");

	// Morning routine for office days
	await Routine.create({
		name: "Office Morning Routine",
		category: "morning",
		steps: [
			{
				order: 1,
				title: "Check weather",
				description: "Umbrella if rain > 30%",
				isOptional: false,
			},
			{
				order: 2,
				title: "Morning skincare",
				description: "Cleanser → Toner → Moisturizer → SPF",
				isOptional: false,
				duration: 5,
			},
			{
				order: 3,
				title: "Pack bag",
				description: "Laptop, charger, water bottle",
				isOptional: false,
			},
			{ order: 4, title: "Put on perfume", isOptional: true },
		],
		recurrence: {
			type: "weekly",
			daysOfWeek: [2, 4], // Office days (Tue, Thu)
		},
		timeWindow: {
			startTime: "06:30",
			endTime: "08:00",
		},
		isActive: true,
	});

	// Evening skincare routine - alternating days
	await Routine.create({
		name: "Evening Skincare (Retinol Days)",
		category: "skincare",
		steps: [
			{
				order: 1,
				title: "Double cleanse",
				description: "Oil cleanser → Water cleanser",
				duration: 3,
				isOptional: false,
			},
			{ order: 2, title: "Toner", isOptional: false },
			{
				order: 3,
				title: "Retinol serum",
				description: "Wait 20 min before next step",
				duration: 20,
				isOptional: false,
			},
			{ order: 4, title: "Moisturizer", isOptional: false },
		],
		recurrence: {
			type: "weekly",
			daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
		},
		timeWindow: {
			startTime: "20:00",
			endTime: "22:00",
		},
		isActive: true,
	});

	await Routine.create({
		name: "Evening Skincare (Hydration Days)",
		category: "skincare",
		steps: [
			{
				order: 1,
				title: "Double cleanse",
				description: "Oil cleanser → Water cleanser",
				duration: 3,
				isOptional: false,
			},
			{ order: 2, title: "Toner", isOptional: false },
			{ order: 3, title: "Hyaluronic acid serum", isOptional: false },
			{
				order: 4,
				title: "Sheet mask",
				description: "15-20 minutes",
				duration: 15,
				isOptional: true,
			},
			{ order: 5, title: "Moisturizer", isOptional: false },
			{ order: 6, title: "Sleeping mask", isOptional: true },
		],
		recurrence: {
			type: "weekly",
			daysOfWeek: [0, 2, 4, 6], // Sun, Tue, Thu, Sat
		},
		timeWindow: {
			startTime: "20:00",
			endTime: "22:00",
		},
		isActive: true,
	});

	// Medication reminder
	await Routine.create({
		name: "Daily Medication",
		category: "medication",
		steps: [
			{
				order: 1,
				title: "Take vitamins",
				description: "With food",
				isOptional: false,
			},
		],
		recurrence: {
			type: "daily",
		},
		timeWindow: {
			startTime: "12:00",
			endTime: "14:00",
		},
		isActive: true,
	});

	console.log("Initializing token health records...");

	// Initialize token health for all services
	const services = ["psn", "xbox", "steam", "google", "tfnsw"] as const;
	for (const service of services) {
		await TokenHealth.create({
			service,
			status: "healthy",
			lastChecked: new Date(),
			errorCount: 0,
		});
	}

	console.log("Seed complete!");
	await mongoose.disconnect();
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
