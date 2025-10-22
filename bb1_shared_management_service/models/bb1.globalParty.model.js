// models/globalparty.model.js
import mongoose, { Schema, model } from 'mongoose';
import { GlobalPartyCounterModel } from './bb1.counter.model.js';

const globalPartySchema = new Schema(
  {
    code: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    partyType: {
      type: [String], // array of roles, e.g. ["Customer","Vendor"]
      required: true,
      enum: {
        values: [
          'None',
          'User',
          'Customer',
          'Vendor',
          'Employee',
          'Worker',
          'Contractor',
          'Company',
          'ContactPerson',
          'Individual',
          'Organization',
          'OperatingUnit',
        ],
        message:
          '{VALUE} is not a valid partyType. Use \'None\',\'Customer\',\'Vendor\',\'Employee\',\'Worker\',\'Contractor\',\'ContactPerson\',\'Individual\',\'Organization\',\'OperatingUnit\'.',
      },
      default: ['None'], // can be an array with default
    },
    // Additional fields common to all parties
    primaryContactNumber: {
      type: String,
    },
    primaryEmail: {
      type: String,
    },
    addresses: [
      {
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        country: String,
        zip: String,
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// For auto-generating a "Party" code if desired
globalPartySchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  try {
    const counterDoc = await GlobalPartyCounterModel.findByIdAndUpdate(
      { _id: 'globalPartyCode' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    if (!counterDoc || counterDoc.seq === undefined) {
      throw new Error('Failed to generate global party code');
    }
    const seqNum = counterDoc.seq.toString().padStart(6, '0');
    this.code = `GP_${seqNum}`;
    next();
  } catch (err) {
    next(err);
  }
});

export const GlobalPartyModel =
  mongoose.models.BB1GlobalParties ||
  model('BB1GlobalParties', globalPartySchema);
