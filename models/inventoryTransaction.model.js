// models/inventoryTransaction.model.js
import mongoose, { Schema, model } from "mongoose";

const txnSchema = new Schema(
  {
    txnDate: { type: Date, required: true, default: Date.now },
    sourceType: {
      type: String,
      enum: [
        "JOURNAL",
        "JOURNAL_PROV", // provisional
        "PURCHASE",
        "SALES",
        "TRANSFER",
        "ADJUSTMENT",
        "COUNTING",
      ],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    sourceLine: { type: Number, default: 1 }, // if applicable

    item: { type: Schema.Types.ObjectId, ref: "Items", required: true },
    dims: {
      site: { type: Schema.Types.ObjectId, ref: "Sites", required: true },
      warehouse: {
        type: Schema.Types.ObjectId,
        ref: "Warehouses",
        required: true,
      },
      zone: { type: Schema.Types.ObjectId, ref: "Zones" },
      location: { type: Schema.Types.ObjectId, ref: "Locations" },
      aisle: { type: Schema.Types.ObjectId, ref: "Aisles" },
      rack: { type: Schema.Types.ObjectId, ref: "Racks" },
      shelf: { type: Schema.Types.ObjectId, ref: "Shelves" },
      bin: { type: Schema.Types.ObjectId, ref: "Bins" },

      config: { type: Schema.Types.ObjectId, ref: "Configurations" },
      color: { type: Schema.Types.ObjectId, ref: "Colors" },
      size: { type: Schema.Types.ObjectId, ref: "Sizes" },
      style: { type: Schema.Types.ObjectId, ref: "Styles" },
      version: { type: Schema.Types.ObjectId, ref: "Versions" },
      batch: { type: Schema.Types.ObjectId, ref: "Batches" },
      serial: { type: Schema.Types.ObjectId, ref: "Serials" },
    },

    qty: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    purchasePrice: { type: Number, default: 0 },
    salesPrice: { type: Number, default: 0 },
    transferPrice: { type: Number, default: 0 },

    taxes: {
      gst: { type: Number, default: 0 },
      withholdingTax: { type: Number, default: 0 },
    },

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

// index for fast lookups by dims + date
txnSchema.index({
  item: 1,
  "dims.site": 1,
  "dims.warehouse": 1,
  "dims.zone": 1,
  "dims.location": 1,
  "dims.aisle": 1,
  "dims.rack": 1,
  "dims.shelf": 1,
  "dims.bin": 1,
  "dims.config": 1,
  "dims.color": 1,
  "dims.size": 1,
  "dims.style": 1,
  "dims.version": 1,
  "dims.batch": 1,
  "dims.serial": 1,
  txnDate: 1,
});

export const InventoryTransactionModel =
  mongoose.models.InventoryTransactions ||
  model("InventoryTransactions", txnSchema);
