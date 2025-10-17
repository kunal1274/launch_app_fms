// models/provisionalBalance.model.js
import mongoose, { Schema, model } from "mongoose";

const provBalanceSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Items", required: true },
    site: { type: Schema.Types.ObjectId, ref: "Sites", required: true },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouses",
      required: true,
    },
    // … include zone, location, aisle, rack, shelf, bin, config, color, size, style, version, batch, serial …
    zone: {
      type: Schema.Types.ObjectId,
      ref: "Zones", // from zone.model.js
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Locations", // from location.model.js
    },
    aisle: {
      type: Schema.Types.ObjectId,
      ref: "Aisles", // from aisle.model.js
    },
    rack: {
      type: Schema.Types.ObjectId,
      ref: "Racks", // from rack.model.js
    },
    shelf: {
      type: Schema.Types.ObjectId,
      ref: "Shelves", // from shelf.model.js
    },
    bin: {
      type: Schema.Types.ObjectId,
      ref: "Bins", // from bin.model.js
    },
    config: {
      type: Schema.Types.ObjectId,
      ref: "Configurations", // from config.model.js
    },
    color: {
      type: Schema.Types.ObjectId,
      ref: "Colors", // from color.model.js
    },
    size: {
      type: Schema.Types.ObjectId,
      ref: "Sizes", // from size.model.js
    },
    style: {
      type: Schema.Types.ObjectId,
      ref: "Styles", // from style.model.js
    },
    version: {
      type: Schema.Types.ObjectId,
      ref: "Versions", // from version.model.js
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: "Batches", // from batch.model.js
    },
    serial: {
      type: Schema.Types.ObjectId,
      ref: "Serials", // from serial.model.js
    },
    quantity: { type: Number, default: 0 },
    totalReserveValue: { type: Number, default: 0 }, // qty * PO-line price
    extras: {
      type: Map,
      of: Schema.Types.Mixed, // can store strings, numbers, objects, etc.
      default: {},
    },
  },
  { timestamps: true }
);

provBalanceSchema.index(
  {
    item: 1,
    site: 1,
    warehouse: 1,
    /* …all dims… */
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

export const ProvisionalBalanceModel =
  mongoose.models.ProvisionalBalances ||
  model("ProvisionalBalances", provBalanceSchema);
