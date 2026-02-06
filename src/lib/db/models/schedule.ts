import mongoose, { type Document, type Model, Schema } from "mongoose";
import type { DayType, TimeBlock, WidgetType } from "@/types";

// Widget configuration within a time block
export interface IWidgetConfig {
	type: WidgetType;
	priority: number; // Lower = more important = larger/higher position
	enabled: boolean;
	config?: Record<string, unknown>; // Widget-specific settings
}

// Time block configuration
export interface ITimeBlockConfig {
	name: TimeBlock;
	startTime: string; // "HH:mm" format
	endTime: string; // "HH:mm" format
	widgets: IWidgetConfig[];
}

// Schedule document interface
export interface ISchedule extends Document {
	name: string;
	dayType: DayType;
	daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
	timeBlocks: ITimeBlockConfig[];
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const WidgetConfigSchema = new Schema<IWidgetConfig>({
	type: {
		type: String,
		enum: ["weather", "transit", "calendar", "gaming", "routine", "medication"],
		required: true,
	},
	priority: {
		type: Number,
		default: 5,
		min: 1,
		max: 10,
	},
	enabled: {
		type: Boolean,
		default: true,
	},
	config: {
		type: Schema.Types.Mixed,
		default: {},
	},
});

const TimeBlockConfigSchema = new Schema<ITimeBlockConfig>({
	name: {
		type: String,
		enum: ["morning", "workday", "evening", "night"],
		required: true,
	},
	startTime: {
		type: String,
		required: true,
		match: /^([01]\d|2[0-3]):([0-5]\d)$/, // HH:mm format
	},
	endTime: {
		type: String,
		required: true,
		match: /^([01]\d|2[0-3]):([0-5]\d)$/,
	},
	widgets: [WidgetConfigSchema],
});

const ScheduleSchema = new Schema<ISchedule>(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		dayType: {
			type: String,
			enum: ["office", "wfh", "weekend"],
			required: true,
		},
		daysOfWeek: {
			type: [Number],
			required: true,
			validate: {
				validator: (arr: number[]) => arr.every((d) => d >= 0 && d <= 6),
				message: "Days must be 0-6 (Sunday-Saturday)",
			},
		},
		timeBlocks: [TimeBlockConfigSchema],
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
	},
);

// Indexes for efficient queries
ScheduleSchema.index({ daysOfWeek: 1, isActive: 1 });
ScheduleSchema.index({ dayType: 1 });

// Prevent model recompilation in development
export const Schedule: Model<ISchedule> =
	mongoose.models.Schedule ||
	mongoose.model<ISchedule>("Schedule", ScheduleSchema);
