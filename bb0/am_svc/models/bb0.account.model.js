// models/account.model.js

import mongoose, { Schema, model } from "mongoose";
import { BB0_LedgerAccountCounterModel } from "../../shm_svc/models/bb0.counter.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Sub‐schema for nested accounts (if you want to embed children; optional)
// ─────────────────────────────────────────────────────────────────────────────
const bb0_accountNodeSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, ref: "BB0_Accounts" },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    children: [
      /* recursively embed if needed, otherwise skip this */
    ],
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Top‐level Account schema
// ─────────────────────────────────────────────────────────────────────────────
const bb0_accountSchema = new Schema(
  {
    sysCode: {
      type: String,
      required: false,
      /// auto generated number like Bank_001, Bank_002 etc.
    },
    // auto generated
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: "BB0_GlobalParties", // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 Customer doc can point to the same globalParty
    },
    accountCode: {
      type: String,
      required: [true, "Account code is required"],
      trim: true,
      //unique: true,
      match: [
        /^[A-Za-z0-9\.\-]+$/,
        "Account code may only contain letters, numbers, dots, dashes",
      ],
      // e.g. "1.1000", or "2000-Expense-Office"
    },
    accountName: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },

    // 2. The “type” of account (helps roll-up into BS or P&L)
    //    Common types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    accType: {
      type: String,
      required: [true, "Account type is required"],
      enum: {
        values: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
        message:
          "`type` must be one of ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE",
      },
    },

    // 3. Parent account reference (allow to build a tree or hierarchy)
    parentAccount: {
      type: Schema.Types.ObjectId,
      ref: "BB0_Accounts",
      default: null,
    },

    // 4. “Normal balance” side: either DEBIT or CREDIT
    //    (helps when building Trial Balance or checking balance sign)
    normalBalance: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: [true, "Normal balance side is required"],
      default: "DEBIT",
    },

    // 5. Whether this account is a “leaf” sub-ledger (i.e. you can post to it),
    //    or a pure “parent”/roll-up account (so you cannot post entries to it directly).
    isLeaf: {
      type: Boolean,
      required: true,
      default: true,
    },

    // 6. Optional “allowManualPost”: if false, you cannot post a GL line directly to this account.
    //    (Sometimes you want certain accounts to be system-only or controlled by sub-ledgers.)
    allowManualPost: {
      type: Boolean,
      required: true,
      default: true,
    },

    // 7. Extra fields like “currency” (if multi-currency chart of accounts),
    //    “description”, “openingBalance” if needed, etc.
    currency: {
      type: String,
      required: true,
      enum: {
        values: ["INR", "USD", "EUR", "GBP"],
        message:
          "⚠️ {VALUE} is not a valid currency. Use among these only'INR','USD','EUR','GBP'.",
      },
      default: "INR",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // 8. Any other flags or “grouping code” if you need multiple COAs
    group: {
      type: String,
      default: "",
      trim: true,
      // e.g. "OPERATIONS", "FINANCE", "GLOBAL" (for multi-entity usage)
    },
    // company: {
    //   type: Schema.Types.ObjectId,
    //   ref: "BB0_Companies",
    // },
    isArchived: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: false,
    },

    // 9. Timestamps
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Indexes & Hooks
// ─────────────────────────────────────────────────────────────────────────────

// Ensure accountCode is unique
bb0_accountSchema.index({ accountCode: 1 }, { unique: true });

// Pre-save hook: if parentAccount is set, ensure parent exists
bb0_accountSchema.pre("save", async function (next) {
  if (this.parentAccount) {
    const parent = await mongoose
      .model("BB0_Accounts")
      .findById(this.parentAccount);
    if (!parent) {
      return next(
        new Error(
          `parentAccount ${this.parentAccount} does not exist in Chart of Accounts.`
        )
      );
    }
    // You might also require that parent.isLeaf = false, i.e. a non-leaf parent.
    if (parent.isLeaf) {
      return next(
        new Error(
          `Cannot assign parentAccount ${this.parentAccount} because it is a leaf node.`
        )
      );
    }
  }

  try {
    await this.validate();

    // Increment counter within the transaction
    const dbResponseNewCounter =
      await BB0_LedgerAccountCounterModel.findOneAndUpdate(
        { _id: "bb0_glAccCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
        //{ new: true, upsert: true, session }
      );

    console.log("Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate bank code");
    }
    // Generate customer code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(6, "0");
    this.sysCode = `LA_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during transaction:", error.stack);
    // Decrement the counter in case of failure
    try {
      await BB0_LedgerAccountCounterModel.findByIdAndUpdate(
        { _id: "bb0_glAccCode" },
        { $inc: { seq: -1 } }
      );
      // }
    } catch (decrementError) {
      console.error("❌ Error during counter decrement:", decrementError.stack);
    }
    next(error);
  } finally {
    console.log("ℹ️ Finally ledger Account counter closed");
  }
});

export const BB0_AccountModel =
  mongoose.models.BB0_Accounts || model("BB0_Accounts", bb0_accountSchema);
