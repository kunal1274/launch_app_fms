import mongoose from "mongoose";
const { Schema, model } = mongoose;

/**
 * A simple group model referencing user owners/members
 */
const UserGroupSchema = new Schema({
  name: { type: String, required: true, trim: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
  secondOwner: { type: Schema.Types.ObjectId, ref: "User", default: null },
  thirdOwner: { type: Schema.Types.ObjectId, ref: "User", default: null },
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

export const UserGroupModel = mongoose.model("UserGroup", UserGroupSchema);
