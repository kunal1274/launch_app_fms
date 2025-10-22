// models/group.model.js

import mongoose, { Schema, model } from 'mongoose';

/**
 * This schema represents a "Group" that can be used by multiple modules
 * (Customer, Vendor, Item, etc.) and multiple companies.
 */
const globalGroupSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      // e.g. "GEN", "PAYMENT_TERM", "VIP", etc.
    },
    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "General Group", "Payment Term Group", "VIP Customers"
    },

    /**
     * Which modules can use this group? e.g. ["Customer","Vendor","Item","Company","Employee",...]
     * If you want to allow multiple modules, just store them all in this array.
     */
    releaseModules: [
      {
        type: String,
        enum: [
          'Customer',
          'Vendor',
          'Item',
          'Company',
          'Employee',
          'Contact',
          // etc. add more if needed
        ],
        required: true,
      },
    ],

    /**
     * Which company(ies) can use this group?
     * We store an array of references to the Company model. If "ALL" is included,
     * that means all companies can use it. Or you can store a special boolean if you prefer.
     */
    releaseCompanies: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Company', // referencing your CompanyModel
      },
    ],

    /**
     * If you want to handle a special "ALL" token, you can do something like:
     * allCompanies: { type: Boolean, default: false },
     * OR store "ALL" as a string in `companiesAllowed`.
     */

    // If you want to store advanced "release wizard" states:
    releaseStage: {
      type: String,
      enum: [
        'Draft',
        'moduleReleased',
        'companyReleased',
        'Released',
        'Cancelled',
      ],
      default: 'Draft',
    },

    // A place to store user-defined key-value pairs if needed
    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

globalGroupSchema.pre('save', function (next) {
  // Example: ensure code is uppercase, name is trimmed, etc.
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
  if (!this.releaseModules || this.releaseModules.length === 0) {
    // You might enforce at least one module must be chosen
    throw new Error(
      'At least one module must be specified in releaseModules as allowed.'
    );
  }
  next();
});

export const GlobalGroupModel =
  mongoose.models.BB1GlobalGroups ||
  model('BB1GlobalGroups', globalGroupSchema);
