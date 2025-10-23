import mongoose, { Schema, model } from 'mongoose';
import { WarehouseCounterModel } from '../../bb1_shared_management_service/models/bb1.counter.model.js';

// Sales Order Schema
const warehouseSchema = new Schema(
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
        values: ['Physical', 'Virtual'],
        message: '⚠️ {VALUE} is not a valid type. Use \'Physical\' or \'Virtual\'.',
      },
      default: 'Physical',
    },

    site: {
      type: Schema.Types.ObjectId,
      ref: 'BB1Sites', // Reference to the Customer model
      required: true,
    },

    whAddress: {
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
      ref: 'BB1Companies',
    },
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'BB1GlobalGroups', // from group.model.js
      },
    ],
    createdBy: {
      type: String,
      required: true,
      default: 'SystemWHCreation',
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

warehouseSchema.pre('save', async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicate itemNum (case-insensitive)
    const existingWH = await WarehouseModel.findOne({
      name: this.name,
    }).collation({
      locale: 'en',
      strength: 2, // Case-insensitive collation
    });

    if (existingWH) {
      throw new Error(
        `❌ A warehouse with this name already exists: ${this.name}`
      );
    }

    // Increment counter for item code
    const dbResponseNewCounter = await WarehouseCounterModel.findOneAndUpdate(
      { _id: 'whCode' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log('ℹ️ Counter increment result:', dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error('❌ Failed to generate warehouse code');
    }

    // Generate item code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(3, '0');
    this.code = `WH_${seqNumber}`;

    next();
  } catch (error) {
    console.error('❌ Error caught during warehouse save:', error.stack);

    next(error);
  } finally {
    console.log('ℹ️ Finally warehouse counter closed');
  }
});

warehouseSchema.pre(/^find/, function (next) {
  this.populate('site', 'code name description type active');
  next();
});

warehouseSchema.index({ name: 1, site: 1 });

export const WarehouseModel =
  mongoose.models.BB1Warehouses || model('BB1Warehouses', warehouseSchema);
