// models/stockBalance.model.js

import mongoose, { Schema, model } from "mongoose";

const stockBalanceSchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "Items",
      required: true,
    },

    // location dimensions (site & warehouse mandatory)
    site: {
      type: Schema.Types.ObjectId,
      ref: "Sites",
      required: true,
    },
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

    // product dimensions (all optional)
    config: { type: Schema.Types.ObjectId, ref: "Configurations" },
    color: { type: Schema.Types.ObjectId, ref: "Colors" },
    size: { type: Schema.Types.ObjectId, ref: "Sizes" },
    style: { type: Schema.Types.ObjectId, ref: "Styles" },
    version: { type: Schema.Types.ObjectId, ref: "Versions" },

    // tracking dims (optional)
    batch: { type: Schema.Types.ObjectId, ref: "Batches" },
    serial: { type: Schema.Types.ObjectId, ref: "Serials" },

    // on-hand metrics
    quantity: { type: Number, required: true, default: 0 },
    totalCostValue: { type: Number, required: true, default: 0 }, // sum(qty * costPrice)
    costPrice: { type: Number, default: 0 }, // moving-average cost
    totalRevenueValue: { type: Number, default: 0 },
    totalPurchaseValue: { type: Number, default: 0 },
    totalReserveValue: { type: Number, default: 0 },
    totalSalesValue: { type: Number, default: 0 },
    extras: {
      type: Map,
      of: Schema.Types.Mixed, // can store strings, numbers, objects, etc.
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ensure one document per unique combination
stockBalanceSchema.index(
  {
    item: 1,
    site: 1,
    warehouse: 1,
    zone: 1,
    location: 1,
    aisle: 1,
    rack: 1,
    shelf: 1,
    bin: 1,
    config: 1,
    color: 1,
    size: 1,
    style: 1,
    version: 1,
    batch: 1,
    serial: 1,
  },
  { unique: true, sparse: true }
);

export const StockBalanceModel =
  mongoose.models.StockBalances || model("StockBalances", stockBalanceSchema);
