import mongoose, { Schema, model } from "mongoose";
import { RackCounterModel } from "./counter.model.js";

// Sales Order Schema
const rackSchema = new Schema(
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

    aisle: {
      type: Schema.Types.ObjectId,
      ref: "Aisles", // Reference to the Customer model
      required: true,
    },

    rackLatLng: {
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
      default: "SystemRackCreation",
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

rackSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicate itemNum (case-insensitive)
    const existingRack = await RackModel.findOne({
      name: this.name,
    }).collation({
      locale: "en",
      strength: 2, // Case-insensitive collation
    });

    if (existingRack) {
      throw new Error(`❌ A rack with this name already exists: ${this.name}`);
    }

    // Increment counter for item code
    const dbResponseNewCounter = await RackCounterModel.findOneAndUpdate(
      { _id: "rackCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log("ℹ️ Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate rack code");
    }

    // Generate item code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(3, "0");
    this.code = `RK_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during rack save:", error.stack);

    next(error);
  } finally {
    console.log("ℹ️ Finally rack counter closed");
  }
});

rackSchema.pre(/^find/, function (next) {
  this.populate("aisle", "code name description type active");
  next();
});

rackSchema.index({ name: 1, location: 1 });

export const RackModel = mongoose.models.Racks || model("Racks", rackSchema);
