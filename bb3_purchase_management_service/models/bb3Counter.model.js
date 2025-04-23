import mongoose, { model, Schema } from "mongoose";

// Define Schema
const customerCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// Check if the model already exists before defining it
export const CustomerCounterModel =
  mongoose.models.CustomerCounters ||
  model("CustomerCounters", customerCounterSchema);

const vendorCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const VendorCounterModel =
  mongoose.models.VendorCounters ||
  model("VendorCounters", vendorCounterSchema);

const itemCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const ItemCounterModel =
  mongoose.models.ItemCounters || model("ItemCounters", itemCounterSchema);

const ledgerAccountCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const LedgerAccountCounterModel =
  mongoose.models.LedgerAccountCounters ||
  model("LedgerAccountCounters", ledgerAccountCounterSchema);

const ledgerMappingCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const LedgerMappingCounterModel =
  mongoose.models.LedgerMappingCounters ||
  model("LedgerMappingCounters", ledgerMappingCounterSchema);

const bankCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const BankCounterModel =
  mongoose.models.BankCounters || model("BankCounters", bankCounterSchema);

const taxCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const TaxCounterModel =
  mongoose.models.TaxCounters || model("TaxCounters", taxCounterSchema);

const SalesOrderCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const SalesOrderCounterModel =
  mongoose.models.SalesOrderCounters ||
  model("SalesOrderCounters", SalesOrderCounterSchema);

const purchaseOrderCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const PurchaseOrderCounterModel =
  mongoose.models.PurchaseOrderCounters ||
  model("PurchaseOrderCounters", purchaseOrderCounterSchema);

const allocationCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const AllocationCounterModel =
  mongoose.models.AllocationCounters ||
  model("AllocationCounters", allocationCounterSchema);
