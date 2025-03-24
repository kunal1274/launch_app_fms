import mongoose from "mongoose";
const { Schema, model } = mongoose;

/**
 * Simple User model with email required
 */
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, default: "" },
    // ...add more fields as needed...
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", UserSchema);
