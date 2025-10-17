// models/bank.model.js

import mongoose, { Schema, model } from "mongoose";
import { BankCounterModel } from "./counter.model.js";

const bankSchema = new Schema(
  {
    sysCode: {
      type: String,
      required: false,
      /// auto generated number like Bank_001, Bank_002 etc.
    },
    // auto generated
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: "GlobalParties", // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 Customer doc can point to the same globalParty
    },
    accountCode: {
      // manually entered for identification
      type: String,
      required: [
        false,
        "⚠️ Bank Account or UPI or Crypto Number  is mandatory and it should be unique",
      ],
      validate: {
        validator: (v) => /^[A-Za-z0-9@._-]+$/.test(v), // Corrected regex
        message:
          "⚠️ Bank Account or UPI or Crypto Number can only contain alphanumeric characters, dashes, or underscores or @ or .",
      },
    },
    bankType: {
      type: String,
      required: true,
      enum: {
        values: [
          "All",
          "BankAndUpi",
          "Cash",
          "Bank",
          "UPI",
          "Crypto",
          "Barter",
        ],
        message:
          "⚠️ {VALUE} is not a valid type. Use 'Cash' or 'Bank' or 'UPI' or 'Crypto' or 'Barter'.",
      },
      default: "Bank",
    },
    address: {
      type: String,
      required: false,
      default: "",
    },
    parentAccount: {
      // if Bank account is hierarchical
      type: Schema.Types.ObjectId,
      ref: "Banks",
      default: null,
    },

    linkedCoaAccount: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      default: null,
      required: [
        true,
        "Every BankAccount must specify the corresponding leaf AccountModel _id",
      ],
    },
    upi: {
      // if type is UPI or BankAndUpi then user is recommended to enter but not mandatory
      type: String,
      required: false,
    },
    bankName: {
      // this is the name of the bank.
      type: String,
      required: false,
    },
    accountHolderName: {
      // the name of the account holder like company or person name who is owning this account.
      type: String,
      required: false,
    },
    ifsc: {
      type: String,
      required: false,
    },
    swift: {
      type: String,
      required: false,
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
    qrDetails: {
      // in case of upi qr code can be given
      type: String,
      default: "",
    },
    digitalSignature: {
      type: String,
      default: "",
    },
    isLeaf: {
      // in case bank accountcodes are hierarchical in nature
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
    ledgerGroup: {
      // this will be used in futuer like to group multiple bank accounts to post to single account code
      type: String,
      default: "",
      trim: true,
      // e.g. "OPERATIONS", "FINANCE", "GLOBAL" (for multi-entity usage)
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub‐schema for nested accounts (if you want to embed children; optional)
// ─────────────────────────────────────────────────────────────────────────────
const bankNodeSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, ref: "Banks" },
    accountCode: { type: String, required: true },
    bankName: { type: String, required: true },
    children: [
      /* recursively embed if needed, otherwise skip this */
    ],
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Indexes & Hooks
// ─────────────────────────────────────────────────────────────────────────────

// Ensure accountCode is unique
bankSchema.index(
  { accountCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      accountCode: { $exists: true, $type: "string", $ne: "" },
    },
  }
);

// Pre-save hook: if parentAccount is set, ensure parent exists
bankSchema.pre("save", async function (next) {
  // if (!this.isNew) {
  //   return next();
  // }
  if (this.parentAccount) {
    const parent = await mongoose.model("Banks").findById(this.parentAccount);
    if (!parent) {
      return next(
        new Error(
          `parentBankAccount ${this.parentAccount} does not exist in Banks.`
        )
      );
    }
    // You might also require that parent.isLeaf = false, i.e. a non-leaf parent.
    if (parent.isLeaf) {
      return next(
        new Error(
          `Cannot assign parentBankAccount ${this.parentAccount} because it is a leaf node.`
        )
      );
    }
  }
  try {
    await this.validate();

    // Increment counter within the transaction
    const dbResponseNewCounter = await BankCounterModel.findOneAndUpdate(
      { _id: "bankCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
      //{ new: true, upsert: true, session }
    );

    console.log("Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate bank code");
    }
    // Generate customer code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(3, "0");
    this.sysCode = `BK_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during transaction:", error.stack);
    // Decrement the counter in case of failure
    try {
      const isCounterIncremented =
        error.message &&
        !error.message.startsWith("❌ Duplicate contact number");
      if (isCounterIncremented) {
        await BankCounterModel.findByIdAndUpdate(
          { _id: "bankCode" },
          { $inc: { seq: -1 } }
        );
      }
    } catch (decrementError) {
      console.error("❌ Error during counter decrement:", decrementError.stack);
    }
    next(error);
  } finally {
    console.log("ℹ️ Finally bank counter closed");
  }
});

export const BankModel = mongoose.models.Banks || model("Banks", bankSchema);
