import mongoose, { model, Schema } from "mongoose";
import { BatchCounterModel } from "../../bb1_shared_management_service/models/bb1.counter.model.js";

const batchSchema = new Schema(
  {
    code: {
      type: String,
      required: false,
      unique: true,
    },
    num: {
      type: String,
      required: true,
    },
    mfgDate: {
      type: Date,
      default: Date.now,
    },
    expDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Created", "Ready", "Closed", "Obsolete"],
      default: "Ready",
    },
    serialTracking: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      required: false,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["Physical", "Virtual"],
        message: "⚠️ {VALUE} is not a valid type. Use 'Physical' or 'Virtual'.",
      },
      default: "Physical",
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
    archived: { type: Boolean, default: false }, // New field
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: "BB1GlobalGroups", // from group.model.js
      },
    ],
    company: {
      type: Schema.Types.ObjectId,
      ref: "BB1Companies",
    },
    // New field for file uploads
    files: [
      {
        fileName: { type: String, required: true }, // Name of the file
        fileType: { type: String, required: true }, // MIME type (e.g., "application/pdf", "image/png")
        fileUrl: { type: String, required: true }, // URL/path of the uploaded file
        uploadedAt: { type: Date, default: Date.now }, // Timestamp for the upload
      },
    ],
    extras: {
      type: Map,
      of: Schema.Types.Mixed, // can store strings, numbers, objects, etc.
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

batchSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    this.num = this.num.trim(); // Trim num before anything

    // Ensure expDate is after mfgDate
    if (this.expDate <= this.mfgDate) {
      throw new Error("❌ Expiry date must be after manufacturing date.");
    }

    await this.validate(); // Ensure schema-level validations

    // Duplicate check for `num` (case-insensitive)
    const existingBatch = await BatchModel.findOne({ num: this.num }).collation(
      {
        locale: "en",
        strength: 2,
      }
    );

    if (existingBatch) {
      throw new Error(`❌ A batch with this num already exists: ${this.num}`);
    }

    // Generate internal batch code only if not already set
    if (!this.code) {
      const counter = await BatchCounterModel.findOneAndUpdate(
        { _id: "batchCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      if (!counter || counter.seq === undefined) {
        throw new Error("❌ Failed to generate Batch code");
      }

      const seqNumber = counter.seq.toString().padStart(9, "0");
      this.code = `BN_${seqNumber}`;
    }

    next();
  } catch (error) {
    console.error("❌ Error during batch save:", error.stack);
    next(error);
  } finally {
    console.log("ℹ️ Batch pre-save complete");
  }
});

// Apply toJSON to include getters

// siteSchema.set("toJSON", { getters: true });

export const BatchModel =
  mongoose.models.BB1Batches || model("BB1Batches", batchSchema);
