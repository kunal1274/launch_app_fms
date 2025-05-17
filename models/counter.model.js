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

const siteCounterSchema = new Schema({
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
  mongoose.models.SiteCounters || model("SiteCounters", siteCounterSchema);

const warehouseCounterSchema = new Schema({
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
  mongoose.models.WarehouseCounters ||
  model("WarehouseCounters", warehouseCounterSchema);

const zoneCounterSchema = new Schema({
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
export const ZoneCounterModel =
  mongoose.models.ZoneCounters || model("ZoneCounters", zoneCounterSchema);

const locationCounterSchema = new Schema({
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
export const LocationCounterModel =
  mongoose.models.LocationCounters ||
  model("LocationCounters", locationCounterSchema);

const aisleCounterSchema = new Schema({
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
export const AisleCounterModel =
  mongoose.models.AisleCounters || model("AisleCounters", aisleCounterSchema);

const rackCounterSchema = new Schema({
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
export const RackCounterModel =
  mongoose.models.RackCounters || model("RackCounters", rackCounterSchema);

const shelfCounterSchema = new Schema({
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
export const ShelfCounterModel =
  mongoose.models.ShelfCounters || model("ShelfCounters", shelfCounterSchema);

const binCounterSchema = new Schema({
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
export const BinCounterModel =
  mongoose.models.BinCounters || model("BinCounters", binCounterSchema);

const productDimConfigCounterSchema = new Schema({
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
  mongoose.models.ProductDimConfigCounters ||
  model("ProductDimConfigCounters", productDimConfigCounterSchema);

const productDimSizeCounterSchema = new Schema({
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
  mongoose.models.ProductDimSizeCounters ||
  model("ProductDimSizeCounters", productDimSizeCounterSchema);

const productDimColorCounterSchema = new Schema({
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
  mongoose.models.ProductDimColorCounters ||
  model("ProductDimColorCounters", productDimColorCounterSchema);

const productDimVersionCounterSchema = new Schema({
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
  mongoose.models.ProductDimVersionCounters ||
  model("ProductDimVersionCounters", productDimVersionCounterSchema);

const productDimStyleCounterSchema = new Schema({
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
  mongoose.models.ProductDimStyleCounters ||
  model("ProductDimStyleCounters", productDimStyleCounterSchema);

const batchGroupCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const BatchGroupCounterModel =
  mongoose.models.BatchGroupCounters ||
  model("BatchGroupCounters", batchGroupCounterSchema);

const serialGroupCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const SerialGroupCounterModel =
  mongoose.models.SerialGroupCounters ||
  model("SerialGroupCounters", serialGroupCounterSchema);

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

const inventJournalCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const InventJournalCounterModel =
  mongoose.models.InventJournalCounters ||
  model("InventJournalCounters", inventJournalCounterSchema);
