// models/inventoryJournal.model.js

import mongoose, { Schema, model } from "mongoose";
import { InventJournalCounterModel } from "./counter.model.js";

// sub‐schema for each journal line
const journalLineSchema = new Schema(
  {
    lineNum: { type: String },
    item: { type: Schema.Types.ObjectId, ref: "Items", required: true },
    lineDate: { type: Date, required: true, default: Date.now }, // may override header.journalDate
    quantity: { type: Number, required: true, default: 1 }, // +ve number always
    loadOnInventoryValue: { type: Number, default: 0 }, // <-- NEW
    // pricing
    costPrice: { type: Number, required: true, default: 0 }, // from your stock-balance service
    purchasePrice: { type: Number, default: 0 }, // if a receipt
    salesPrice: { type: Number, default: 0 }, // if an issue
    transferPrice: { type: Number, default: 0 }, // if TRANSFER

    // taxes (only for TRANSFER)
    transferGst: { type: Number, default: 0 },
    transferWithholdingTax: { type: Number, default: 0 },

    // location dims
    from: {
      site: { type: Schema.Types.ObjectId, ref: "Sites" },
      warehouse: { type: Schema.Types.ObjectId, ref: "Warehouses" },
      zone: { type: Schema.Types.ObjectId, ref: "Zones" },
      location: { type: Schema.Types.ObjectId, ref: "Locations" },
      aisle: { type: Schema.Types.ObjectId, ref: "Aisles" },
      rack: { type: Schema.Types.ObjectId, ref: "Racks" },
      shelf: { type: Schema.Types.ObjectId, ref: "Shelves" },
      bin: { type: Schema.Types.ObjectId, ref: "Bins" },
    },
    to: {
      site: { type: Schema.Types.ObjectId, ref: "Sites" },
      warehouse: { type: Schema.Types.ObjectId, ref: "Warehouses" },
      zone: { type: Schema.Types.ObjectId, ref: "Zones" },
      location: { type: Schema.Types.ObjectId, ref: "Locations" },
      aisle: { type: Schema.Types.ObjectId, ref: "Aisles" },
      rack: { type: Schema.Types.ObjectId, ref: "Racks" },
      shelf: { type: Schema.Types.ObjectId, ref: "Shelves" },
      bin: { type: Schema.Types.ObjectId, ref: "Bins" },
    },

    // product dims
    config: { type: Schema.Types.ObjectId, ref: "Configurations" },
    color: { type: Schema.Types.ObjectId, ref: "Colors" },
    size: { type: Schema.Types.ObjectId, ref: "Sizes" },
    style: { type: Schema.Types.ObjectId, ref: "Styles" },
    version: { type: Schema.Types.ObjectId, ref: "Versions" },

    // tracking dims
    batch: { type: Schema.Types.ObjectId, ref: "Batches" },
    serial: { type: Schema.Types.ObjectId, ref: "Serials" },

    remarks: { type: String },
    attributes: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

// journal header
const inventoryJournalSchema = new Schema(
  {
    code: {
      type: String,
      unique: true,
    },

    type: {
      type: String,
      required: true,
      enum: ["INOUT", "ADJUSTMENT", "COUNTING", "TRANSFER"],
    },
    status: {
      type: String,
      required: true,
      enum: ["DRAFT", "POSTED", "CANCELLED", "ADMINMODE", "ANYMODE"],
      default: "DRAFT",
    },

    journalDate: { type: Date, required: true, default: Date.now },
    reference: { type: String },
    description: { type: String },

    posted: { type: Boolean, default: false },
    postedAt: { type: Date },

    company: { type: Schema.Types.ObjectId, ref: "Companies", required: false },
    groups: [{ type: Schema.Types.ObjectId, ref: "GlobalGroups" }],

    lines: {
      type: [journalLineSchema],
      required: true,
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "A journal must have at least one line.",
      },
    },
  },
  {
    timestamps: true,
  }
);

// index for code
inventoryJournalSchema.index({ code: 1 }, { unique: true });

// auto‐generate code + default lineDate
inventoryJournalSchema.pre("validate", async function (next) {
  // generate code if missing
  if (!this.code) {
    const ctr = await InventJournalCounterModel.findOneAndUpdate(
      { _id: "inventJournalCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.code = `IJ_${String(ctr.seq).padStart(6, "0")}`;
  }

  // assign lineNum and default any missing lineDate to journalDate
  // if (this.lines.length > 0) {
  this.lines.forEach((line, idx) => {
    line.lineNum = idx + 1;
    if (!line.lineDate) {
      line.lineDate = this.journalDate;
    }
  });
  // }

  next();
});

export const InventoryJournalModel =
  mongoose.models.InventoryJournals ||
  model("InventoryJournals", inventoryJournalSchema);
