import mongoose, { Schema, model } from 'mongoose';

// 1) Define a sub‐schema for the “defaults” block
const accountDefaultsSchema = new Schema(
  {
    // these are YOUR defaults, not Schema options:
    accountType: {
      // renamed from “type” to avoid collision with Schema’s own type key
      type: String,
      required: true,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
      default: 'ASSET',
    },
    normalBalance: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      default: 'DEBIT',
    },
    isLeaf: { type: Boolean, default: true },
    allowManualPost: { type: Boolean, default: true },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'EUR', 'GBP'],
      default: 'INR',
    },
    description: { type: String, default: '' },
    group: { type: String, default: '' },
  },
  { _id: false }
);

const bb0_accountTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      unique: true,
      trim: true,
    },
    defaults: {
      type: accountDefaultsSchema,
      required: true,
    },
  },
  { timestamps: true }
);

export const BB0_AccountTemplateModel =
  mongoose.models.BB0_AccountTemplates ||
  model('BB0_AccountTemplates', bb0_accountTemplateSchema);
