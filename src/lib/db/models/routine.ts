import mongoose, { type Document, type Model, Schema } from "mongoose";

// Individual step in a routine
export interface IRoutineStep {
	order: number;
	title: string;
	description?: string;
	duration?: number; // Duration in minutes
	isOptional: boolean;
}

// Routine recurrence pattern
export interface IRecurrence {
	type: "daily" | "weekly" | "custom";
	// For weekly: which days (0-6)
	daysOfWeek?: number[];
	// For custom: specific dates or pattern
	customPattern?: string;
}

// Routine document interface
export interface IRoutine extends Document {
	name: string;
	category: "morning" | "evening" | "medication" | "skincare" | "custom";
	steps: IRoutineStep[];
	recurrence: IRecurrence;
	timeWindow: {
		startTime: string; // "HH:mm"
		endTime: string;
	};
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const RoutineStepSchema = new Schema<IRoutineStep>({
	order: {
		type: Number,
		required: true,
	},
	title: {
		type: String,
		required: true,
		trim: true,
	},
	description: {
		type: String,
		trim: true,
	},
	duration: {
		type: Number,
		min: 1,
	},
	isOptional: {
		type: Boolean,
		default: false,
	},
});

const RecurrenceSchema = new Schema<IRecurrence>({
	type: {
		type: String,
		enum: ["daily", "weekly", "custom"],
		required: true,
	},
	daysOfWeek: {
		type: [Number],
		validate: {
			validator: (arr: number[]) => !arr || arr.every((d) => d >= 0 && d <= 6),
			message: "Days must be 0-6",
		},
	},
	customPattern: String,
});

const RoutineSchema = new Schema<IRoutine>(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		category: {
			type: String,
			enum: ["morning", "evening", "medication", "skincare", "custom"],
			required: true,
		},
		steps: [RoutineStepSchema],
		recurrence: {
			type: RecurrenceSchema,
			required: true,
		},
		timeWindow: {
			startTime: {
				type: String,
				required: true,
				match: /^([01]\d|2[0-3]):([0-5]\d)$/,
			},
			endTime: {
				type: String,
				required: true,
				match: /^([01]\d|2[0-3]):([0-5]\d)$/,
			},
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
	},
);

RoutineSchema.index({ category: 1, isActive: 1 });
RoutineSchema.index({ "recurrence.daysOfWeek": 1 });

export const Routine: Model<IRoutine> =
	mongoose.models.Routine || mongoose.model<IRoutine>("Routine", RoutineSchema);
