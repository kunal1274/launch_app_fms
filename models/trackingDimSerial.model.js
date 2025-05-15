// models/serial.model.js

import mongoose, { model, Schema } from "mongoose";
import { SerialCounterModel } from "./counter.model.js";

// ——— Sub-schema for each serial value ———
const serialValueSchema = new Schema(
  {
    num: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    mfgDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expDate: {
      type: Date,
      required: true,
      default: function () {
        // `this` is the sub‐document; add 24h (in ms) to mfgDate
        return new Date(this.mfgDate.getTime() + 24 * 60 * 60 * 1000);
      },
    },
    status: {
      type: String,
      enum: ["Created", "Ready", "Closed", "Obsolete"],
      default: "Ready",
    },

    // if you later need serial-tracking per value:
    serialTracking: {
      type: Boolean,
      default: false,
    },
    serialNumbers: {
      type: [String],
      default: [],
      // only required if serialTracking===true
      validate: {
        validator(arr) {
          return !this.serialTracking || (Array.isArray(arr) && arr.length > 0);
        },
        message: "Enable serialTracking to supply at least one serial number.",
      },
    },

    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

// ——— Top-level serial schema ———
const serialSchema = new Schema(
  {
    // auto-generated master code for the serial group
    code: {
      type: String,
      unique: true,
    },

    name: {
      type: String,
      required: false,
    },
    // your array of individual seriales
    values: {
      type: [serialValueSchema],
      default: [],
    },

    description: String,
    type: {
      type: String,
      enum: ["Physical", "Virtual"],
      default: "Physical",
    },
    active: {
      type: Boolean,
      default: false,
    },
    archived: {
      type: Boolean,
      default: false,
    },

    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: "GlobalGroups",
      },
    ],
    company: {
      type: Schema.Types.ObjectId,
      ref: "Companies",
    },

    files: [
      {
        fileName: { type: String, required: true },
        fileOriginalName: { type: String, required: true },
        fileType: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileUploadedAt: { type: Date, default: Date.now },
      },
    ],

    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ——— Index to enforce unique master code ———
serialSchema.index({ code: 1 }, { unique: true });

// ——— Validate sub-docs & generate `code` ———
serialSchema.pre("validate", async function (next) {
  // 1) Ensure each value has expDate > mfgDate
  for (const val of this.values) {
    if (val.expDate <= val.mfgDate) {
      return next(
        new Error(
          `Expiry date must be after manufacturing date for serial ${val.num}.`
        )
      );
    }
  }

  // 2) Ensure no duplicate `num` within this.values array
  const nums = this.values.map((v) => v.num.toLowerCase().trim());
  const dup = nums.find((n, i) => nums.indexOf(n) !== i);
  if (dup) {
    return next(new Error(`Duplicate serial number in values: "${dup}".`));
  }

  // 3) Auto-generate master `code` if missing
  if (!this.code) {
    const counter = await SerialCounterModel.findOneAndUpdate(
      { _id: "serialCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    if (!counter?.seq && counter.seq !== 0) {
      return next(new Error("Failed to generate serial code"));
    }
    this.code = `SL_${String(counter.seq).padStart(9, "0")}`;
  }

  next();
});

export const SerialModel =
  mongoose.models.Serials || model("Serials", serialSchema);
