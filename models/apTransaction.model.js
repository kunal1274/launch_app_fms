// models/apTransaction.model.js
import mongoose, { Schema, model } from "mongoose";

const apTxnSchema = new Schema(
  {
    txnDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sourceType: {
      type: String,
      enum: ["PURCHASE"], // always PURCHASE for AP
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      //ref: "PurchaseOrders",
    },
    sourceLine: {
      type: Number,
      default: 1,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Vendors",
      //required: true,
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

export const APTransactionModel =
  mongoose.models.APTransactions || model("APTransactions", apTxnSchema);
