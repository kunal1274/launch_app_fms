import mongoose, { Schema, model } from "mongoose";

const stageSchema = new Schema(
  {
    sequence: { type: Number, required: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const templateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: { type: String, trim: true, default: "" },
    journalType: {
      type: String,
      required: true,
      enum: ["STANDARD", "REVERSAL", "ADJUSTMENT", "PERIOD_CLOSE"],
    },
    allowHeader: { type: Boolean, default: true },
    mandatorySingleHeader: { type: Boolean, default: false },
    workflowRequired: { type: Boolean, default: false },
    stages: {
      type: [stageSchema],
      default: [],
      validate: {
        validator(arr) {
          const seqs = arr.map((s) => s.sequence);
          return new Set(seqs).size === seqs.length;
        },
        message: "Each stage must have a unique sequence",
      },
    },
    statusTransitions: {
      type: Map,
      of: [String],
      default: {},
    },
  },
  { timestamps: true }
);

templateSchema.index({ name: 1 });

export const JournalTemplateModel =
  mongoose.models.JournalTemplates || model("JournalTemplates", templateSchema);
