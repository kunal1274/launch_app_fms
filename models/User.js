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
    archived: { type: Boolean, default: false }, // New field
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: "GlobalGroups", // from group.model.js
      },
    ],
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", UserSchema);
