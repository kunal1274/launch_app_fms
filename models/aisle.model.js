import mongoose, { Schema, model } from "mongoose";
import { AisleCounterModel } from "./counter.model.js";

// Sales Order Schema
const aisleSchema = new Schema(
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

    location: {
      type: Schema.Types.ObjectId,
      ref: "Locations", // Reference to the Customer model
      required: true,
    },

    aisleLatLng: {
      type: String, // Adjust the type if address is more complex
      required: false, // Ensures that salesAddress is always set
    },
    remarks: {
      type: String, // Adjust the type if address is more complex
      required: false, // Ensures that salesAddress is always set
    },
    archived: { type: Boolean, default: false }, // New field
    company: {
      type: Schema.Types.ObjectId,
      ref: "Companies",
    },
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: "GlobalGroups", // from group.model.js
      },
    ],
    createdBy: {
      type: String,
      required: true,
      default: "SystemAisleCreation",
    },
    updatedBy: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
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

    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        //delete ret.__v;
        // Sort the keys alphabetically for easier reading
        const sorted = {};
        Object.keys(ret)
          .sort()
          .forEach((key) => {
            sorted[key] = ret[key];
          });
        return sorted;
      },
    },
    toObject: { virtuals: true },
  }
);

aisleSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicate itemNum (case-insensitive)
    const existingAisle = await AisleModel.findOne({
      name: this.name,
    }).collation({
      locale: "en",
      strength: 2, // Case-insensitive collation
    });

    if (existingAisle) {
      throw new Error(`❌ A aisle with this name already exists: ${this.name}`);
    }

    // Increment counter for item code
    const dbResponseNewCounter = await AisleCounterModel.findOneAndUpdate(
      { _id: "aisleCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log("ℹ️ Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate aisle code");
    }

    // Generate item code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(3, "0");
    this.code = `AS_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during aisle save:", error.stack);

    next(error);
  } finally {
    console.log("ℹ️ Finally aisle counter closed");
  }
});

aisleSchema.pre(/^find/, function (next) {
  this.populate("location", "code name description type active").populate(
    "zone",
    "code name description type active"
  );
  next();
});

aisleSchema.index({ name: 1, location: 1 });

export const AisleModel =
  mongoose.models.Aisles || model("Aisles", aisleSchema);
