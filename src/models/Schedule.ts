import { Schema, model, models } from "mongoose";

const OverrideSchema = new Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  mode: { type: String, enum: ["office","home"], required: true },
}, { _id: false });

const ScheduleSchema = new Schema({
  officeDays: { type: [Number], default: [2,4] }, // Tue, Thu
  overrides: { type: [OverrideSchema], default: [] },
  skincareCycleDays: { type: Number, default: 3 },
  skincareStartDate: { type: String, required: true }, // "YYYY-MM-DD"

  commute: {
    from: { type: String, default: "Lidcombe" },
    to:   { type: String, default: "Bondi Junction" },
    lines: { type: [String], default: ["T2","T3","T4"] }
  },

  medicationTimes: {
    office: { type: [String], default: ["08:00","23:00"] },
    home:   { type: [String], default: ["10:00","16:00","23:00"] }
  },

  weatherThresholds: {
    tempDelta: { type: Number, default: 5 },
    uvHigh: { type: Number, default: 8 }
  }
}, { timestamps: true });

ScheduleSchema.index({ "overrides.date": 1 }, { unique: true, partialFilterExpression: { "overrides.date": { $type: "string" }}});

export default models.Schedule || model("Schedule", ScheduleSchema);