import mongoose, { Schema, model } from 'mongoose';

/**
 * Subschema for Bank Account Details.
 * This schema holds information for one bank account.
 */
const BankDetailsSchema = new Schema(
  {
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    bankAddress: {
      type: String,
      required: false,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
    },
    swiftCode: {
      type: String,
      required: false,
      trim: true,
    },
    upiDetails: {
      type: String,
      required: false,
      trim: true,
    },
    qrDetails: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { _id: false }
); // _id false to prevent a separate id for each subdocument

/**
 * Subschema for Tax Information.
 */
const TaxInfoSchema = new Schema(
  {
    gstNumber: {
      type: String,
      required: false,
      trim: true,
    },
    tanNumber: {
      type: String,
      required: false,
      trim: true,
    },
    panNumber: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Main Company Schema.
 */
const CompanySchema = new Schema(
  {
    companyCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: (v) => /^[A-Za-z0-9_-]+$/.test(v),
        message:
          '⚠️ Company Code can only contain alphanumeric characters, dashes, or underscores.',
      },
      // You can enforce uppercase if needed by using a pre-save hook.
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: 'BB1GlobalParties', // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 user doc can point to the same globalParty
    },
    businessType: {
      type: String,
      required: true,
      enum: {
        values: [
          'Individual',
          'Community',
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
    primaryGSTAddress: {
      type: String,
      required: true,
      trim: true,
    },
    secondaryOfficeAddress: {
      type: String,
      required: false,
      trim: true,
    },
    tertiaryShippingAddress: {
      type: String,
      required: false,
      trim: true,
    },
    logoImage: {
      type: String,
      required: false,
      trim: true,
      // Typically a URL pointing to the company logo image.
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    contactNumber: {
      type: String,
      required: false,
      trim: true,
    },
    website: {
      type: String,
      required: false,
      trim: true,
    },
    bankDetails: [BankDetailsSchema], // Array of bank account details.
    taxInfo: TaxInfoSchema, // Tax information subdocument.
    // Additional fields if needed (like active flag, created/updated timestamps) can be added:
    archived: { type: Boolean, default: false }, // New field
    createdBy: {
      type: String,
      required: true,
      default: 'SystemCompanyCreation',
    },
    updatedBy: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'BB1GlobalGroups', // from group.model.js
      },
    ],
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
        // Remove __v if you wish
        //delete ret.__v;
        // Sort keys alphabetically for easier reading
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

/**
 * Pre-save hook to normalize and validate fields.
 * For example, we ensure that email is lowercase and trim companyCode.
 */
CompanySchema.pre('save', function (next) {
  // Ensure email is lowercase (this is already done by the schema 'lowercase' option)
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  // Trim companyCode and companyName, etc.
  if (this.companyCode) {
    this.companyCode = this.companyCode.trim();
    this.companyCode = this.companyCode.toUpperCase();
  }
  if (this.companyName) {
    this.companyName = this.companyName.trim();
  }
  // Optionally, force companyCode to uppercase:
  // this.companyCode = this.companyCode.toUpperCase();

  next();
});

/**
 * Pre-find hook to automatically filter out inactive companies (if desired).
 * Uncomment the following if you want every find query to include active: true.
 */
// CompanySchema.pre(/^find/, function (next) {
//   this.where({ active: true });
//   next();
// });

/**
 * Indexing:
 * - Unique index on companyCode and email.
 */
// CompanySchema.index({ companyCode: 1 });
// CompanySchema.index({ email: 1 });

export const CompanyModel =
  mongoose.models.BB1Companies || model('BB1Companies', CompanySchema);
