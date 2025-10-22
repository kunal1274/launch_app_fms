import mongoose, { Schema, model } from 'mongoose';
import { ShelfCounterModel } from './counter.model.js';

// Sales Order Schema
const shelfSchema = new Schema(
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

    rack: {
      type: Schema.Types.ObjectId,
      ref: 'Racks', // Reference to the Customer model
      required: true,
    },

    shelfLatLng: {
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
      ref: 'Companies',
    },
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'GlobalGroups', // from group.model.js
      },
    ],
    createdBy: {
      type: String,
      required: true,
      default: 'SystemShelfCreation',
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

shelfSchema.pre('save', async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicate itemNum (case-insensitive)
    const existingShelf = await ShelfModel.findOne({
      name: this.name,
    }).collation({
      locale: 'en',
      strength: 2, // Case-insensitive collation
    });

    if (existingShelf) {
      throw new Error(`❌ A shelf with this name already exists: ${this.name}`);
    }

    // Increment counter for item code
    const dbResponseNewCounter = await ShelfCounterModel.findOneAndUpdate(
      { _id: 'shelfCode' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log('ℹ️ Counter increment result:', dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error('❌ Failed to generate shelf code');
    }

    // Generate item code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(3, '0');
    this.code = `SH_${seqNumber}`;

    next();
  } catch (error) {
    console.error('❌ Error caught during shelf save:', error.stack);

    next(error);
  } finally {
    console.log('ℹ️ Finally shelf counter closed');
  }
});

shelfSchema.pre(/^find/, function (next) {
  this.populate('rack', 'code name description type active');
  next();
});

shelfSchema.index({ name: 1, location: 1 });

export const ShelfModel =
  mongoose.models.Shelves || model('Shelves', shelfSchema);
