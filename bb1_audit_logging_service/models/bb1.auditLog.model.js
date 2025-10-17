import mongoose from "mongoose";
const { Schema, model } = mongoose;

/**
 * AuditLog schema to store actions performed on any entity.
 */
const auditLogSchema = new Schema(
  {
    user: {
      // Typically references a User model. If you only have a username,
      // store it as a string. If you have a real user collection, do:
      type: Schema.Types.ObjectId,
      ref: "UserGlobal",
      //type: String,
      required: false,
      // default: "UnknownUser",
    },
    module: {
      // e.g. "Company", "SalesOrder", "Customer", "Vendor"
      type: String,
      required: true,
    },
    action: {
      // e.g. "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", etc.
      type: String,
      required: true,
    },
    recordId: {
      // The _id of the document that was changed
      type: Schema.Types.ObjectId,
      required: true,
    },
    changes: {
      // Store old vs. new data, or any relevant diff
      type: Object,
      default: {},
    },
  },
  {
    // Keep timestamps if you want createdAt and updatedAt automatically
    // but note we already set createdAt in the schema
    timestamps: true,
  }
);

export const AuditLogModel =
  mongoose.models.BB1AuditLogs || model("BB1AuditLogs", auditLogSchema);
