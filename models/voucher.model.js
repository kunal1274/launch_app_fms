// models/voucher.model.js
import mongoose, { Schema, model } from 'mongoose';

// Sub-schema for each GL line
const voucherLineSchema = new Schema({
  accountCode: { type: String, required: true },
  subledgerCode: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  currency: { type: String, required: true },
  exchangeRate: { type: Number, required: true }, // rate to functional currency
  localAmount: { type: Number, required: false, default: 0 }, // = (dr - cr) * exchangeRate
  // optional storage/product dims for inventory lines:
  dims: {
    site: { type: Schema.Types.ObjectId, ref: 'Sites' },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouses' },
    zone: { type: Schema.Types.ObjectId, ref: 'Zones' },
    location: { type: Schema.Types.ObjectId, ref: 'Locations' },
    aisle: { type: Schema.Types.ObjectId, ref: 'Aisles' },
    rack: { type: Schema.Types.ObjectId, ref: 'Racks' },
    shelf: { type: Schema.Types.ObjectId, ref: 'Shelves' },
    bin: { type: Schema.Types.ObjectId, ref: 'Bins' },
    config: { type: Schema.Types.ObjectId, ref: 'Configurations' },
    color: { type: Schema.Types.ObjectId, ref: 'Colors' },
    size: { type: Schema.Types.ObjectId, ref: 'Sizes' },
    style: { type: Schema.Types.ObjectId, ref: 'Styles' },
    version: { type: Schema.Types.ObjectId, ref: 'Versions' },
    batch: { type: Schema.Types.ObjectId, ref: 'Batches' },
    serial: { type: Schema.Types.ObjectId, ref: 'Serials' },
  },
  // link back to sub-ledger txn
  subledger: {
    sourceType: {
      type: String,
      enum: [
        'INVENTORY',
        'AR',
        'TAX',
        'WHT',
        'CHARGES',
        'LINE_AR',
        'FX',
        'DISCOUNT',
        'JOURNAL',
        'LEDGER',
      ],
      required: true,
    },
    txnId: { type: Schema.Types.ObjectId, required: true },
    lineNum: { type: Number, default: 1 },
  },
  extras: { type: Map, of: Schema.Types.Mixed, default: {} },
});

const voucherSchema = new Schema(
  {
    voucherNo: { type: String, required: true, unique: true },
    previousVoucherNo: { type: String, default: null },
    nextVoucherNo: { type: String, default: null },
    relatedVoucherNo: { type: String, default: null },
    previousPostingEventType: {
      type: String,
      required: true,
      enum: [
        'NONE',
        'POSITIONAL',
        'PHYSICAL',
        'MANAGEMENT',
        'FINANCIAL',
        'AUDIT',
      ],
      default: 'NONE',
    },
    postingEventType: {
      type: String,
      required: true,
      enum: [
        'NONE',
        'POSITIONAL',
        'PHYSICAL',
        'MANAGEMENT',
        'FINANCIAL',
        'AUDIT',
      ],
      default: 'NONE',
    },
    nextPostingEventType: {
      type: String,
      required: true,
      enum: [
        'NONE',
        'POSITIONAL',
        'PHYSICAL',
        'MANAGEMENT',
        'FINANCIAL',
        'AUDIT',
      ],
      default: 'NONE',
    },
    voucherDate: { type: Date, required: true, default: Date.now },
    sourceType: {
      type: String,
      enum: ['SALES_ORDER', 'SALES_INVOICE', 'PURCHASE_ORDER', 'JOURNAL'],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    // ── NEW: link back to the SalesOrder invoice
    invoiceRef: {
      invoiceId: {
        type: Schema.Types.ObjectId,
        ref: 'SalesOrders',
        required: true,
      },
      invoiceNum: { type: String, required: true },
    },
    lines: { type: [voucherLineSchema], required: true },
  },
  { timestamps: true }
);

voucherSchema.pre('save', function (next) {
  this.lines = this.lines.map((l) => {
    l.localAmount =
      Math.round((l.debit - l.credit) * l.exchangeRate * 100) / 100;
    return l;
  });
  next();
});

export const VoucherModel =
  mongoose.models.FinancialVouchers ||
  model('FinancialVouchers', voucherSchema);
