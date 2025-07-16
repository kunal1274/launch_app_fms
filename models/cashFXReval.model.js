import mongoose, { Schema, model } from "mongoose";

const cashFXRevalSchema = new Schema(
  {
    bankAccount: {
      type: Schema.Types.ObjectId,
      ref: "Banks",
      required: [true, "Bank account is required for FX revaluation"],
    },
    asOfDate: {
      type: Date,
      required: [true, "asOfDate is required"],
    },
    spotRate: {
      type: Number,
      required: [true, "spotRate is required"],
    },

    // computed at run time
    netForeign: {
      type: Number,
      required: [true, "netForeign balance is required"],
    },
    bookedLocal: {
      type: Number,
      required: [true, "bookedLocal balance is required"],
    },
    revaluedLocal: {
      type: Number,
      required: [true, "revaluedLocal balance is required"],
    },
    diffLocal: {
      type: Number,
      required: [true, "diffLocal is required"],
    },

    // link back to the GL journal entry that recorded this reval
    glJournal: {
      type: Schema.Types.ObjectId,
      ref: "GLJournals",
      required: [true, "GL Journal reference is required"],
    },

    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

// ensure you only run one reval per bank account per date
cashFXRevalSchema.index({ bankAccount: 1, asOfDate: 1 }, { unique: true });

export const CashFXRevalModel =
  mongoose.models.CashFXRevals || model("CashFXRevals", cashFXRevalSchema);
