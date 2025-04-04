// models/User.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const UserGlobalSchema = new Schema(
  {
    email: {
      type: String,
      required: function () {
        return !this.phoneNumber;
      },
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    password: { type: String, required: false, default: "" },
    phoneNumber: {
      type: String,
      required: function () {
        return !this.email;
      },
      unique: false,
      trim: true,
      sparse: true,
    },
    name: { type: String, default: "" },
    method: {
      type: String,
      enum: ["phone", "email"],
      required: true,
      default: "email",
    },
    signInMethod: {
      type: String,
      enum: ["otp", "gmail", "password"],
      required: true,
      default: "otp",
    },
    // multiple user groups
    userGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserGroup",
      },
    ],
    // multiple user Roles
    userRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserRole",
      },
    ],
  },
  { timestamps: true }
);

export const UserGlobalModel =
  mongoose.models.UserGlobal || model("UserGlobal", UserGlobalSchema);
