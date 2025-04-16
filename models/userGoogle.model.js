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
  { timestamps: true }
);

export const UserGoogleModel =
  mongoose.models.UserGoogle || model("UserGoogle", UserGoogleSchema);
