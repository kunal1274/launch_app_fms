import mongoose, { model, Schema } from "mongoose";
import { ProductDimConfigCounterModel } from "./counter.model.js";

const productDimConfigSchema = new Schema(
  {
    code: {
      type: String,
      required: false,
      unique: true,
    },

    name: {
      type: String,
      required: true,
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
    values: {
      type: [String],
      required: true,
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
        ref: "GlobalGroups", // from group.model.js
      },
    ],
    company: {
      type: Schema.Types.ObjectId,
      ref: "Companies",
    },
    // New field for file uploads
    files: [
      {
        fileName: { type: String, required: true }, // Name of the file
        fileOriginalName: { type: String, required: true },
        fileType: { type: String, required: true }, // MIME type (e.g., "application/pdf", "image/png")
        fileUrl: { type: String, required: true }, // URL/path of the uploaded file
        fileUploadedAt: { type: Date, default: Date.now }, // Timestamp for the upload
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

productDimConfigSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicate itemNum (case-insensitive)
    const existingConfig = await ProductDimConfigModel.findOne({
      name: this.name,
    }).collation({
      locale: "en",
      strength: 2, // Case-insensitive collation
    });

    if (existingConfig) {
      throw new Error(
        `❌ A config with this name already exists: ${this.name}`
      );
    }

    // Increment counter for item code
    const dbResponseNewCounter =
      await ProductDimConfigCounterModel.findOneAndUpdate(
        { _id: "configCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

    console.log("Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate Config code");
    }

    // Generate item code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(3, "0");
    this.code = `CFG_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during config save:", error.stack);

    next(error);
  } finally {
    console.log("ℹ️ Finally config counter closed");
  }
});

// Apply toJSON to include getters

// siteSchema.set("toJSON", { getters: true });

export const ProductDimConfigModel =
  mongoose.models.Configurations ||
  model("Configurations", productDimConfigSchema);
