import { Schema, model, models } from "mongoose";

const RoutineSchema = new Schema({
  type: { type: String, enum: ["officeMorning","homeMorning","skincare"], required: true },
  day: { type: Number }, // only for skincare 1..3
  steps: { type: [String], default: [] },
}, { timestamps: true });

RoutineSchema.index({ type: 1, day: 1 }, { unique: true, partialFilterExpression: { day: { $exists: true } }});

export default models.Routine || model("Routine", RoutineSchema);