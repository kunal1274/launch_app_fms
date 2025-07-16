// models/arTransaction.model.js
import mongoose, { Schema, model } from "mongoose";

const arTxnSchema1 = new Schema(
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

const arTxnSchema = new Schema(
  {
    txnDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sourceType: {
      type: String,
      enum: ["SALES"], // always SALES in this context
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      //ref: "SalesOrders", // or whichever model holds your invoice
    },
    // Optional line‐number if you allow multi‐line invoices:
    sourceLine: {
      type: Number,
      default: 1,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customers",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      //min: [0, "Amount ≥ 0"],
    },
    currency: {
      type: String,
      required: true,
    },
    exchangeRate: {
      type: Number,
      required: true,
      min: [0, "ExchangeRate ≥ 0"],
    },
    localAmount: {
      type: Number,
      required: true,
    },
    bankAccount: {
      type: Schema.Types.ObjectId,
      ref: "BankAccounts",
      //required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const ARTransactionModel =
  mongoose.models.ARTransactions || model("ARTransactions", arTxnSchema);
