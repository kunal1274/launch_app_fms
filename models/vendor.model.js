import mongoose, { model, Schema } from "mongoose";
import { VendorCounterModel } from "./counter.model.js";

const vendorSchema = new Schema(
  {
    code: {
      type: String,
      required: false,
      unique: true,
    },
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: "GlobalParties", // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 Customer doc can point to the same globalParty
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
        ],
        message:
          "⚠️ {VALUE} is not a valid currency. Use among these only Individual or Manufacturing, Service Provider, Trading, Distributor,Retailer,Wholesaler.",
      },
      default: "Trading",
    },
    name: {
      type: String,
      required: true,
    },
    contactNum: {
      type: String,
      required: [true, "⚠️ Contact number is required."],
      unique: true,
      minlength: [
        10,
        "⚠️ The phone number should be exactly 10 digits without country code.",
      ],
      maxlength: [10, "⚠️ The phone number should be exactly 10 digits."],
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v); // Only allows exactly 10 digits
        },
        message:
          "⚠️ Contact number must be a 10-digit number without any letters or special characters.",
      },
    },
    email: {
      type: String,
      required: [false, "⚠️ Email is not mandatory but recommended."],
      unique: true,
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
    paymentTerms: {
      type: String,
      required: true,
      enum: {
        values: [
          "COD",
          "Net30D",
          "Net7D",
          "Net15D",
          "Net45D",
          "Net60D",
          "Net90D",
          "Advance",
        ],
        message:
          "⚠️ {VALUE} is not a valid currency. Use among these only COD,Net30D,Net7D,Net15D,Net45D,Net60D,Net90D,Advance.",
      },
      default: "Net30D",
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
      required: false, // made it false to align if not required or if some business hs no registration num
      minLength: [
        15,
        `⚠️ The registration number should be with min. 15 chars`,
      ],
      maxLength: [
        15,
        `⚠️ The registration number cannot be greater than 15 chars.`,
      ],
      default: "",
    },
    panNum: {
      type: String,
      required: false, // rt now kept it false
      minLength: [10, `⚠️ The pan number should be with min. 10 chars`],
      maxLength: [10, `⚠️ The pan number cannot be greater than 10 chars.`],
      default: "",
    },
    address: {
      type: String,
      required: false,
      default: "false",
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
    bankDetails: [
      {
        code: {
          type: String,
          required: false,
          unique: true,
        },
        type: {
          type: String,
          required: true,
          enum: {
            values: ["Cash", "Bank", "UPI", "Crypto", "Barter"],
            message:
              "⚠️ {VALUE} is not a valid type. Use 'Cash' or 'Bank' or 'UPI' or 'Crypto' or 'Barter'.",
          },
          default: "Bank",
        },
        bankNum: {
          type: String,
          required: [
            true,
            "⚠️ Bank Account or UPI or Crypto Number  is mandatory and it should be unique",
          ],
          unique: true,
          validate: {
            validator: (v) => /^[A-Za-z0-9@._-]+$/.test(v), // Corrected regex
            message:
              "⚠️ Bank Account or UPI or Crypto Number can only contain alphanumeric characters, dashes, or underscores or @ or .",
          },
        },
        name: {
          type: String,
          required: true,
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
  }
);

vendorSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicates in the database
    const existingVendor = await VendorModel.findOne({
      contactNum: this.contactNum,
    }); //.session(session);
    if (existingVendor) {
      throw new Error(`❌ Duplicate contact number: ${this.contactNum}`);
    }

    // Increment counter within the transaction
    const dbResponseNewCounter = await VendorCounterModel.findOneAndUpdate(
      { _id: "vendorCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
      //{ new: true, upsert: true, session }
    );

    console.log("ℹ️ Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("❌ Failed to generate vendor code");
    }

    // Generate vendor code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(6, "0");
    this.code = `V_${seqNumber}`;

    next();
  } catch (error) {
    console.error("❌ Error caught during transaction:", error.stack);

    // Decrement the counter in case of failure
    try {
      const isCounterIncremented =
        error.message && !error.message.startsWith("Duplicate contact number");
      if (isCounterIncremented) {
        await VendorCounterModel.findByIdAndUpdate(
          { _id: "vendorCode" },
          { $inc: { seq: -1 } }
        );
      }
    } catch (decrementError) {
      console.error("❌ Error during counter decrement:", decrementError.stack);
    }

    next(error);
  } finally {
    console.log("ℹ️ Finally vendor counter closed");
  }
});

export const VendorModel =
  mongoose.models.Vendors || model("Vendors", vendorSchema);
