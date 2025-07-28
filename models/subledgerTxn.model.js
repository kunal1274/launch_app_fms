import mongoose, { Schema, model } from "mongoose";

const subTxnSchema = new Schema(
  {
    txnDate: { type: Date, required: true, default: Date.now },
    relatedVoucher: { type: String, required: false },
    // which “bucket” of subledger
    subledgerType: {
      type: String,
      required: true,
      enum: [
        "AR",
        "AP",
        "TAX",
        "INV",
        "WHT",
        "CHARGES",
        "DISCOUNT",
        "BANK",
        "LEDGER",
      ],
    },
    sourceType: {
      type: String,
      required: true,
      enum: [
        "SALES",
        "PURCHASE",
        "JOURNAL",
        "BANK_TRANSFER",
        "JOURNAL_REVERSAL",
      ],
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    sourceLine: { type: Number, default: 1 },
    lineNum: { type: Number, required: true },

    // optional party link
    ledgerAccount: { type: Schema.Types.ObjectId, ref: "Accounts" },
    customer: { type: Schema.Types.ObjectId, ref: "Customers" },
    supplier: { type: Schema.Types.ObjectId, ref: "Vendors" },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccounts" },

    // for ITEM-level charges or discounts
    item: { type: Schema.Types.ObjectId, ref: "Items" },

    // amount in transaction currency
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    exchangeRate: { type: Number, required: true },
    // = amount * exchangeRate (rounded)
    localAmount: { type: Number, required: true },

    // attach dims for inventory‐related line charges
    dims: {
      site: { type: Schema.Types.ObjectId, ref: "Sites" },
      warehouse: { type: Schema.Types.ObjectId, ref: "Warehouses" },
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

    extras: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// fast lookup by source / type / date
subTxnSchema.index({
  subledgerType: 1,
  sourceType: 1,
  sourceId: 1,
  txnDate: 1,
});

// Auto-assign lineNum = max+1 per (subledgerType, sourceType, sourceId)
subTxnSchema.pre("validate", async function (next) {
  if (this.isNew) {
    const filter = {
      subledgerType: this.subledgerType,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
    };
    const last = await this.constructor
      .findOne(filter)
      .sort({ lineNum: -1 })
      .select("lineNum")
      .lean();
    this.lineNum = last ? last.lineNum + 1 : 1;
  }
  next();
});

export const SubledgerTransactionModel =
  mongoose.models.SubledgerTransactions ||
  model("SubledgerTransactions", subTxnSchema);
