import mongoose, { model, Schema } from 'mongoose';
import { BB0_CustomerCounterModel } from '../../shm_svc/models/bb0.counter.model.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bb0_customerSchema = new Schema(
  {
    // auto generated on save
    sysCode: {
      type: String,
      required: false,
      unique: true,
    },
    // auto generated
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: 'BB0_GlobalParties', // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 Customer doc can point to the same globalParty
    },
    businessType: {
      type: String,
      required: true,
      enum: {
        values: [
          'Individual',
          'Manufacturing',
          'ServiceProvider',
          'Trading',
          'Distributor',
          'Retailer',
          'Wholesaler',
          'Others',
        ],
        message:
          '⚠️ {VALUE} is not a valid currency. Use among these only Individual or Manufacturing, Service Provider, Trading, Distributor,Retailer,Wholesaler.',
      },
      default: 'Trading',
    },
    name: {
      type: String,
      required: true,
    },
    parentAccount: {
      // if Custmer account is hierarchical
      type: Schema.Types.ObjectId,
      ref: 'BB0_Customers',
      default: null,
    },
    contactNum: {
      type: String,
      required: [true, 'Contact number is required.'],
      minlength: [
        10,
        '⚠️ The phone number should be exactly 10 digits without country code.',
      ],
      maxlength: [10, '⚠️ The phone number should be exactly 10 digits.'],
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v); // Only allows exactly 10 digits
        },
        message:
          '⚠️ Contact number must be a 10-digit number without any letters or special characters.',
      },
    },
    email: {
      type: String,
      required: [false, '👍 Email is not mandatory but recommended.'],
      //unique: true,
      validate: {
        validator: function (v) {
          // Simple pattern: "something@something.something"
          return !v || emailRegex.test(v);
          // "!v ||" allows empty if 'required: false'
        },
        message:
          '⚠️ Email must be a valid email format (e.g. user@example.com).',
      },
      default: '',
    },
    contactPersonName: {
      type: String,
      required: false,
      default: '',
    },
    contactPersonPhone: {
      type: String,
      required: [false, 'Contact number is required.'],

      validate: {
        validator: function (v) {
          return !v || /^\d{10}$/.test(v); // Only allows exactly 10 digits
        },
        message:
          '⚠️ Contact number must be a 10-digit number without any letters or special characters.',
      },
      default: '',
    },
    contactPersonEmail: {
      type: String,
      required: [false, '👍 Email is not mandatory but recommended.'],

      validate: {
        validator: function (v) {
          // Simple pattern: "something@something.something"
          return !v || emailRegex.test(v);
          // "!v ||" allows empty if 'required: false'
        },
        message:
          '⚠️ Email must be a valid email format (e.g. user@example.com).',
      },
      default: '',
    },
    currency: {
      type: String,
      required: true,
      enum: {
        values: ['INR', 'USD', 'EUR', 'GBP'],
        message:
          '⚠️ {VALUE} is not a valid currency. Use among these only\'INR\',\'USD\',\'EUR\',\'GBP\'.',
      },
      default: 'INR',
    },
    logoImage: {
      type: String,
      required: false,
      trim: true,
      // Typically a URL pointing to the customer logo image.
    },
    paymentTerms: {
      type: String,
      required: true,
      enum: {
        values: [
          'COD',
          'Net30D',
          'Net7D',
          'Net15D',
          'Net45D',
          'Net60D',
          'Net90D',
          'Advance',
        ],
        message:
          '⚠️ {VALUE} is not a valid currency. Use among these only COD,Net30D,Net7D,Net15D,Net45D,Net60D,Net90D,Advance.',
      },
      default: 'Net30D',
      // need validation on the sales order that if net 30 means the due date is invoice date plus 30 days , for net 90 invoice dt plus 90 days , for cod it is equal to invoice date.. how to implement this .
    },
    creditLimit: {
      type: Number,
      required: true,
      default: 0.0,
      set: (v) => Math.round(v * 100) / 100,
    },
    registrationNum: {
      type: String,
      required: false,
      minLength: [
        15,
        '⚠️ The registration number should be with min. 15 chars',
      ],
      maxLength: [
        15,
        '⚠️ The registration number cannot be greater than 15 chars.',
      ],
      default: '',
    },
    panNum: {
      type: String,
      required: false,
      minLength: [10, '⚠️ The pan number should be with min. 10 chars'],
      maxLength: [10, '⚠️ The pan number cannot be greater than 10 chars.'],
      default: '',
    },
    tanNum: {
      type: String,
      required: false,
      minLength: [10, '⚠️ The tan number should be with min. 10 chars'],
      maxLength: [10, '⚠️ The tan number cannot be greater than 10 chars.'],
      default: '',
    },
    address: {
      type: String,
      required: false,
      default: '',
    },
    ledgerGroup: {
      // this will be used in futuer like to group multiple customer accounts to post to single account code
      type: String,
      default: '',
      trim: true,
      // e.g. "OPERATIONS", "FINANCE", "GLOBAL" (for multi-entity usage)
    },
    linkedCoaAccount: {
      type: Schema.Types.ObjectId,
      ref: 'BB0_Accounts',
      default: null,
      required: [
        false,
        'Every Customer Account must specify the corresponding leaf AccountModel _id',
      ],
    },
    remarks: {
      type: String,
      required: false,
      default: '',
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
    isArchived: { type: Boolean, default: false }, // New field
    bankDetails: [
      {
        sysCode: {
          type: String,
          required: false,
        },
        bankType: {
          type: String,
          required: true,
          enum: {
            values: [
              'All',
              'BankAndUpi',
              'Cash',
              'Bank',
              'UPI',
              'Crypto',
              'Barter',
            ],
            message:
              '⚠️ {VALUE} is not a valid type. Use \'Cash\' or \'Bank\' or \'UPI\' or \'Crypto\' or \'Barter\'.',
          },
          default: 'Bank',
        },
        bankAccNum: {
          type: String,
          required: [
            false,
            '⚠️ Bank Account or UPI or Crypto Number  is mandatory and it should be unique',
          ],
          validate: {
            validator: (v) => /^[A-Za-z0-9@._-]+$/.test(v), // Corrected regex
            message:
              '⚠️ Bank Account or UPI or Crypto Number can only contain alphanumeric characters, dashes, or underscores or @ or .',
          },
        },
        upi: {
          type: String,
          required: false,
        },
        bankName: {
          type: String,
          required: false,
        },
        accountHolderName: {
          type: String,
          required: false,
        },
        ifsc: {
          type: String,
          required: false,
        },
        swift: {
          type: String,
          required: false,
        },
        active: {
          type: Boolean,
          required: true,
          default: false,
        },
        qrDetails: {
          type: String,
          default: '',
        },
      },
    ],
    // logoImage: {
    //   type: String,
    //   required: false,
    //   trim: true,
    //   // Typically a URL pointing to the company logo image.
    // },
    files: [
      {
        fileName: { type: String, required: true }, // Name of the file
        fileOriginalName: { type: String, required: true },
        fileType: { type: String, required: true }, // MIME type (e.g., "application/pdf", "image/png")
        fileUrl: { type: String, required: true }, // URL/path of the uploaded file
        fileUploadedAt: { type: Date, default: Date.now }, // Timestamp for the upload
      },
    ],
    /**
     * NEW: an array referencing 'Group' docs that have been attached to this Customer.
     */
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'BB0_GlobalGroups', // from group.model.js
      },
    ],
    company: {
      type: Schema.Types.ObjectId,
      ref: 'BB0_Companies',
    },

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

bb0_customerSchema.pre('save', async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicates in the database
    const existingCustomer = await BB0_CustomerModel.findOne({
      contactNum: this.contactNum,
    }); //.session(session);
    if (existingCustomer) {
      throw new Error(`❌ Duplicate contact number: ${this.contactNum}`);
    }

    // Increment counter within the transaction
    const dbResponseNewCounter =
      await BB0_CustomerCounterModel.findOneAndUpdate(
        { _id: 'bb0_customerCode' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
        //{ new: true, upsert: true, session }
      );

    //console.log("Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error('❌ Failed to generate customer code');
    }

    // Generate customer code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(6, '0');
    this.sysCode = `C_${seqNumber}`;

    next();
  } catch (error) {
    console.error('❌ Error caught during transaction:', error.stack);

    // Decrement the counter in case of failure
    try {
      const isCounterIncremented =
        error.message &&
        !error.message.startsWith('❌ Duplicate contact number');
      if (isCounterIncremented) {
        await BB0_CustomerCounterModel.findByIdAndUpdate(
          { _id: 'bb0_customerCode' },
          { $inc: { seq: -1 } }
        );
      }
    } catch (decrementError) {
      console.error('❌ Error during counter decrement:', decrementError.stack);
    }

    next(error);
  } finally {
    console.log('ℹ️ Finally customer counter closed');
  }
});

bb0_customerSchema.pre(/^find/, function (next) {
  this.populate('globalPartyId', 'sysCode active');
  next();
});

bb0_customerSchema.pre('validate', function (next) {
  if (
    this.contactPersonName &&
    !this.contactPersonPhone &&
    !this.contactPersonEmail
  ) {
    this.invalidate(
      'contactPersonPhone',
      '⚠️ Either phone or email is required if contact person name is provided.'
    );
    this.invalidate(
      'contactPersonEmail',
      '⚠️ Either phone or email is required if contact person name is provided.'
    );
  }
  next();
});

// Then add:
bb0_customerSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: 'string', $ne: '' },
    },
  }
);

bb0_customerSchema.index(
  { contactNum: 1 },
  {
    unique: true,
    partialFilterExpression: {
      contactNum: { $exists: true, $type: 'string', $ne: '' },
    },
  }
);

bb0_customerSchema.index(
  { 'bankDetails.bankNum': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'bankDetails.bankNum': { $exists: true, $type: 'string', $ne: '' },
    },
  }
);

bb0_customerSchema.index(
  { 'bankDetails.sysCode': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'bankDetails.sysCode': { $exists: true, $type: 'string', $ne: '' },
    },
  }
);

export const BB0_CustomerModel =
  mongoose.models.BB0_Customers || model('BB0_Customers', bb0_customerSchema);
