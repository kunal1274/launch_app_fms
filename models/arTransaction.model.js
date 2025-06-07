// models/arTransaction.model.js
import mongoose, { Schema, model } from "mongoose";

const arTxnSchema = new Schema(
  {
    txnDate: { type: Date, required: true, default: Date.now },
    sourceType: {
      type: String,
      enum: ["SALES", "PURCHASE", "JOURNAL"],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    sourceLine: { type: Number, default: 1 },
    customer: { type: Schema.Types.ObjectId, ref: "Customers", required: true },
    amount: { type: Number, required: true },
    extras: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const ARTransactionModel =
  mongoose.models.ARTransactions || model("ARTransactions", arTxnSchema);
