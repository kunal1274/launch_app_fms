// models/User.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const UserGoogleSchema = new Schema(
  {
    googleId: {
      type: String,
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: String,
  },
  { timestamps: true }
);

export const UserGoogleModel =
  mongoose.models.UserGoogle || model("UserGoogle", UserGoogleSchema);
