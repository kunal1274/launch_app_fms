// models/User.js
import mongoose from 'mongoose';
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
    password: { type: String, required: false, default: '' },
    globalPartyId: {
      type: Schema.Types.ObjectId,
      ref: 'GlobalParties', // Reference to the Party model. Party model can generate a party id which can be a customer and/or vendor and/or employee and/or worker and/or contractor and/or contact person and/or any person and/or organization like company and/or operating units etc.
      required: false,
      unique: true, //ensures only 1 user doc can point to the same globalParty
    },
    defaultCompany: {
      type: Schema.Types.ObjectId,
      ref: 'Companies',
    },
    phoneNumber: {
      type: String,
      required: function () {
        return !this.email;
      },
      unique: false,
      trim: true,
      sparse: true,
    },
    name: { type: String, default: '' },
    method: {
      type: String,
      enum: ['phone', 'email'],
      required: true,
      default: 'email',
    },
    signInMethod: {
      type: String,
      enum: ['otp', 'gmail', 'password'],
      required: true,
      default: 'otp',
    },
    // multiple user groups
    userGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGroup',
      },
    ],
    // multiple user Roles
    userRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserRoles',
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
    archived: { type: Boolean, default: false }, // New field
    groups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'GlobalGroups', // from group.model.js
      },
    ],
  },
  { timestamps: true }
);

export const UserGlobalModel =
  mongoose.models.UserGlobal || model('UserGlobal', UserGlobalSchema);
