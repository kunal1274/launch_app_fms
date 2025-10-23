// models/globalparty.model.js
import mongoose, { Schema, model } from 'mongoose';
import { BB0_GlobalPartyCounterModel } from '../../shm_svc/models/bb0.counter.model.js';

const bb0_globalPartySchema = new Schema(
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
          'Item',
          'Bank',
          'Account',
          // need to think on site masters etc.
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
bb0_globalPartySchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  try {
    const counterDoc = await BB0_GlobalPartyCounterModel.findByIdAndUpdate(
      { _id: 'bb0_globalPartyCode' },
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

export const BB0_GlobalPartyModel =
  mongoose.models.BB0_GlobalParties ||
  model('BB0_GlobalParties', bb0_globalPartySchema);
