import mongoose, { model, Schema } from "mongoose";
import { ItemCounterModel } from "./counter.model.js";

const itemSchema = new Schema(
  {
    code: {
      type: String,
      required: false,
      unique: true,
    },
    itemNum: {
      type: String,
      required: [true, "⚠️ Item Number is mandatory and it should be unique"],
      unique: true,
      validate: {
        validator: (v) => /^[A-Za-z0-9_-]+$/.test(v),
        message:
          "⚠️ Item Number can only contain alphanumeric characters, dashes, or underscores.",
      },
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
        values: ["Goods", "Services"],
        message: "⚠️ {VALUE} is not a valid type. Use 'Goods' or 'Services'.",
      },
      default: "Goods",
    },
    unit: {
      type: String,
      required: true,
      enum: {
        values: ["ea", "pcs", "qty", "mt", "kgs", "lbs", "hr", "min", "box", "dozen", "gallon", "liter", "sqft", "sqm", "cft", "cm"],
        message:
          "⚠️ {VALUE} is not a valid unit. Use among these only: ea, pcs, qty, mt, kgs, lbs, hr, min, box, dozen, gallon, liter, sqft, sqm, cft, cm.",
      },
      default: "pcs",
    },
    price: {
      type: Number,
      required: true,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100; // round off during save
      },
      get: (v) => v.toFixed(2), // Format when retrieving
    },
    costPrice: {
      type: Number,
      required: true,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
      get: (v) => v.toFixed(2),
    },
    minPrice: {
      type: Number,
      required: false,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    maxPrice: {
      type: Number,
      required: false,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    category: {
      type: String,
      required: false,
      enum: {
        values: ["Raw Material", "Finished Goods", "Semi-Finished", "Consumables", "Tools", "Equipment", "Services"],
        message: "⚠️ {VALUE} is not a valid category.",
      },
      default: "Finished Goods",
    },
    site: {
      type: Schema.Types.ObjectId,
      ref: "Sites", // from site.model.js
    },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouses", // from warehouse.model.js
    },
    zone: {
      type: Schema.Types.ObjectId,
      ref: "Zones", // from zone.model.js
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Locations", // from location.model.js
    },
    aisle: {
      type: Schema.Types.ObjectId,
      ref: "Aisles", // from aisle.model.js
    },
    rack: {
      type: Schema.Types.ObjectId,
      ref: "Racks", // from rack.model.js
    },
    shelf: {
      type: Schema.Types.ObjectId,
      ref: "Shelves", // from shelf.model.js
    },
    bin: {
      type: Schema.Types.ObjectId,
      ref: "Bins", // from bin.model.js
    },
    config: {
      type: Schema.Types.ObjectId,
      ref: "Configurations", // from config.model.js
    },
    color: {
      type: Schema.Types.ObjectId,
      ref: "Colors", // from color.model.js
    },
    size: {
      type: Schema.Types.ObjectId,
      ref: "Sizes", // from size.model.js
    },
    style: {
      type: Schema.Types.ObjectId,
      ref: "Styles", // from style.model.js
    },
    version: {
      type: Schema.Types.ObjectId,
      ref: "Versions", // from version.model.js
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: "Batches", // from batch.model.js
    },
    serial: {
      type: Schema.Types.ObjectId,
      ref: "Serials", // from serial.model.js
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
    linkedCoaAccount: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      default: null,
      required: [
        false,
        "Every Item should specify the corresponding leaf AccountModel _id",
      ],
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

itemSchema.pre("save", async function (next) {
  try {
    // Validate price ranges
    if (this.minPrice > this.costPrice) {
      throw new Error("❌ Minimum price cannot be greater than cost price");
    }
    if (this.costPrice > this.price) {
      throw new Error("❌ Cost price cannot be greater than selling price");
    }
    if (this.price > this.maxPrice && this.maxPrice > 0) {
      throw new Error("❌ Selling price cannot be greater than maximum price");
    }

    if (!this.isNew) {
      return next();
    }

    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicate itemNum (case-insensitive)
    const existingItem = await ItemModel.findOne({
      itemNum: this.itemNum,
    }).collation({
      locale: "en",
      strength: 2, // Case-insensitive collation
    });

    if (existingItem) {
      throw new Error(
        `❌ An item with this itemNum already exists: ${this.itemNum}`
      );
    }

    // Increment counter for item code
    const dbResponseNewCounter = await ItemCounterModel.findOneAndUpdate(
      { _id: "itemCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log("Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate item code");
    }

    // Generate item code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(6, "0");
    this.code = `I_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during item save:", error.stack);

    next(error);
  } finally {
    console.log("ℹ️ Finally item counter closed");
  }
});

// Apply toJSON to include getters

itemSchema.set("toJSON", { getters: true });

export const ItemModel = mongoose.models.Items || model("Items", itemSchema);
