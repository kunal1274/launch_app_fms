import mongoose, { model, Schema } from "mongoose";

// Define Schema
const bb1customerCounterSchema = new Schema({
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
  mongoose.models.BB1CustomerCounters ||
  model("BB1CustomerCounters", bb1customerCounterSchema);

const bb1siteCounterSchema = new Schema({
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
export const SiteCounterModel =
  mongoose.models.BB1SiteCounters ||
  model("BB1SiteCounters", bb1siteCounterSchema);

const bb1warehouseCounterSchema = new Schema({
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
export const WarehouseCounterModel =
  mongoose.models.BB1WarehouseCounters ||
  model("BB1WarehouseCounters", bb1warehouseCounterSchema);

const bb1productDimConfigCounterSchema = new Schema({
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
export const ProductDimConfigCounterModel =
  mongoose.models.BB1ProductDimConfigCounters ||
  model("BB1ProductDimConfigCounters", bb1productDimConfigCounterSchema);

const bb1productDimSizeCounterSchema = new Schema({
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
export const ProductDimSizeCounterModel =
  mongoose.models.BB1ProductDimSizeCounters ||
  model("BB1ProductDimSizeCounters", bb1productDimSizeCounterSchema);

const bb1productDimColorCounterSchema = new Schema({
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
export const ProductDimColorCounterModel =
  mongoose.models.BB1ProductDimColorCounters ||
  model("BB1ProductDimColorCounters", bb1productDimColorCounterSchema);

const bb1productDimVersionCounterSchema = new Schema({
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
export const ProductDimVersionCounterModel =
  mongoose.models.BB1ProductDimVersionCounters ||
  model("BB1ProductDimVersionCounters", bb1productDimVersionCounterSchema);

const bb1productDimStyleCounterSchema = new Schema({
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
export const ProductDimStyleCounterModel =
  mongoose.models.BB1ProductDimStyleCounters ||
  model("BB1ProductDimStyleCounters", bb1productDimStyleCounterSchema);

const batchCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const BatchCounterModel =
  mongoose.models.BatchCounters || model("BatchCounters", batchCounterSchema);

const serialCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const SerialCounterModel =
  mongoose.models.SerialCounters ||
  model("SerialCounters", serialCounterSchema);

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

// Define Schema
const globalPartyCounterSchema = new Schema({
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
export const GlobalPartyCounterModel =
  mongoose.models.BB1GlobalPartyCounters ||
  model("BB1GlobalPartyCounters", globalPartyCounterSchema);
