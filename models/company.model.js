import mongoose, { Schema, model } from "mongoose";
import { dbgModels } from "../index.js";

/**
 * Subschema for Bank Account Details.
 * This schema holds information for one bank account.
 */

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bankDetailsSchema = new Schema(
  {
    code: {
      type: String,
      required: false,
      // unique: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["BankAndUpi", "Cash", "Bank", "UPI", "Crypto", "Barter"],
        message:
          "⚠️ {VALUE} is not a valid type. Use 'Cash' or 'Bank' or 'UPI' or 'Crypto' or 'Barter'.",
      },
      default: "Bank",
    },
    bankAccNum: {
      type: String,
      required: [
        false,
        "⚠️ Bank Account or UPI or Crypto Number  is mandatory and it should be unique",
      ],
      // unique: true,
      validate: {
        validator: (v) => /^[A-Za-z0-9@._-]+$/.test(v), // Corrected regex
        message:
          "⚠️ Bank Account or UPI or Crypto Number can only contain alphanumeric characters, dashes, or underscores or @ or .",
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
      default: "",
    },
  },
  { _id: true }
); // _id false to prevent a separate id for each subdocument

/**
 * Subschema for Tax Information.
 */
const taxInfoSchema = new Schema(
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
  { _id: true }
);

/**
 * Main Company Schema.
 */
const companySchema = new Schema(
  {
    companyCode: {
      type: String,
      required: true,
      //unique: true,
      trim: true,
      validate: {
        validator: (v) => /^[A-Za-z0-9_-]+$/.test(v),
        message:
          "⚠️ Company Code can only contain alphanumeric characters, dashes, or underscores.",
      },
      // You can enforce uppercase if needed by using a pre-save hook.
    },
    // auto generated
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: "GlobalParties", // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 company doc can point to the same globalParty
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      required: true,
      enum: {
        values: [
          "Individual",
          "Manufacturing",
          "ServiceProvider",
          "Trading",
          "Distributor",
          "Retailer",
          "Wholesaler",
          "Others",
        ],
        message:
          "⚠️ {VALUE} is not a valid currency. Use among these only Individual or Manufacturing, Service Provider, Trading, Distributor,Retailer,Wholesaler.",
      },
      default: "Trading",
    },
    currency: {
      type: String,
      required: true,
      enum: {
        values: ["INR", "USD", "EUR", "GBP"],
        message:
          "⚠️ {VALUE} is not a valid currency. Use among these only'INR','USD','EUR','GBP'.",
      },
      default: "INR",
    },
    remarks: {
      type: String,
      required: false,
      default: "",
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
      required: [false, "⚠️ Email is not mandatory but recommended."],
      validate: {
        validator: function (v) {
          // Simple pattern: "something@something.something"
          return !v || emailRegex.test(v);
          // "!v ||" allows empty if 'required: false'
        },
        message:
          "⚠️ Email must be a valid email format (e.g. user@example.com).",
      },
      default: "",
      lowercase: true,
    },
    contactNum: {
      type: String,
      required: false,
      trim: true,
    },
    website: {
      type: String,
      required: false,
      trim: true,
    },
    bankDetails: [bankDetailsSchema], // Array of bank account details.
    taxInfo: taxInfoSchema, // Tax information subdocument.
    // Additional fields if needed (like active flag, created/updated timestamps) can be added:
    archived: { type: Boolean, default: false }, // New field
    createdBy: {
      type: String,
      required: true,
      default: "SystemCompanyCreation",
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
        ref: "GlobalGroups", // from group.model.js
      },
    ],
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
companySchema.pre("save", function (next) {
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

companySchema.pre(/^find/, function (next) {
  this.populate("globalPartyId", "code active");
  next();
});

// Then add:
companySchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: "string", $ne: "" },
    },
  }
);

companySchema.index(
  { contactNum: 1 },
  {
    unique: true,
    partialFilterExpression: {
      contactNum: { $exists: true, $type: "string", $ne: "" },
    },
  }
);

companySchema.index(
  { "bankDetails.bankNum": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "bankDetails.bankNum": { $exists: true, $type: "string", $ne: "" },
    },
  }
);

companySchema.index(
  { "bankDetails.code": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "bankDetails.code": { $exists: true, $type: "string", $ne: "" },
    },
  }
);

export const CompanyModel =
  mongoose.models.Companies || model("Companies", companySchema);
