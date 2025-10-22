// models/Otp.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const UserOtpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,

      required: function () {
        return !this.email;
      },
      trim: true,
    },
    email: {
      type: String,

      required: function () {
        return !this.phoneNumber;
      },
      trim: true,
      lowercase: true,
    },
    otp: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      enum: ['whatsapp', 'sms', 'email'],
      required: true,
    },
    otpType: {
      type: String,
      enum: ['numeric', 'alphanumeric', 'alphanumeric_special'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => Date.now() + 15 * 60 * 1000, // otp expires in 15 mins
    },
    createdAt: { type: Date, default: Date.now() }, // Document expires after 300*5 seconds eqv to 15 mins
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

UserOtpSchema.index({ email: 1 }, { unique: true, sparse: true });
UserOtpSchema.index({ phoneNumber: 1 }, { unique: false, sparse: true });
// module.exports = mongoose.model("Otp", OtpSchema);

export const UserOtpModel =
  mongoose.models.UserOtp || model('UserOtp', UserOtpSchema);
