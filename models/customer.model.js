import mongoose, { model, Schema } from "mongoose";
import { CustomerCounterModel } from "./counter.model.js";

const customerSchema = new Schema(
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
    contactNum: {
      type: String,
      required: [true, "Contact number is required."],
      unique: true,
      minlength: [
        10,
        "The phone number should be exactly 10 digits without country code.",
      ],
      maxlength: [10, "The phone number should be exactly 10 digits."],
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v); // Only allows exactly 10 digits
        },
        message:
          "Contact number must be a 10-digit number without any letters or special characters.",
      },
    },
    currency: {
      type: String,
      required: true,
      enum: {
        values: ["INR", "USD", "EUR", "GBP"],
        message:
          "{VALUE} is not a valid currency. Use among these only'INR','USD','EUR','GBP'.",
      },
      default: "INR",
    },
    registrationNum: {
      type: String,
      required: true,
      minLength: [15, `The registration number should be with min. 15 chars`],
      maxLength: [
        15,
        `The registration number cannot be greater than 15 chars.`,
      ],
    },
    panNum: {
      type: String,
      required: true,
      minLength: [10, `The pan number should be with min. 10 chars`],
      maxLength: [10, `The pan number cannot be greater than 10 chars.`],
    },
    address: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  try {
    // Validate the document (schema-level validation)
    await this.validate();

    // Check for duplicates in the database
    const existingCustomer = await CustomerModel.findOne({
      contactNum: this.contactNum,
    }); //.session(session);
    if (existingCustomer) {
      throw new Error(`Duplicate contact number: ${this.contactNum}`);
    }

    // Increment counter within the transaction
    const dbResponseNewCounter = await CustomerCounterModel.findOneAndUpdate(
      { _id: "customerCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
      //{ new: true, upsert: true, session }
    );

    console.log("Counter increment result:", dbResponseNewCounter);

    if (!dbResponseNewCounter || dbResponseNewCounter.seq === undefined) {
      throw new Error("Failed to generate customer code");
    }

    // Generate customer code
    const seqNumber = dbResponseNewCounter.seq.toString().padStart(6, "0");
    this.code = `C_${seqNumber}`;

    next();
  } catch (error) {
    console.error("Error caught during transaction:", error.stack);

    // Decrement the counter in case of failure
    try {
      const isCounterIncremented =
        error.message && !error.message.startsWith("Duplicate contact number");
      if (isCounterIncremented) {
        await CustomerCounterModel.findByIdAndUpdate(
          { _id: "customerCode" },
          { $inc: { seq: -1 } }
        );
      }
    } catch (decrementError) {
      console.error("Error during counter decrement:", decrementError.stack);
    }

    next(error);
  } finally {
    console.log("Finally customer counter closed");
  }
});

export const CustomerModel =
  mongoose.models.Customers || model("Customers", customerSchema);
