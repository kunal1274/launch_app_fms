import { AuditLogModel } from '../models/auditLog.model.js';

/**
 * Create an audit log entry.
 * @param {Object} options - The details for the log entry
 * @param {String} options.user - The user performing the action (username or userId)
 * @param {String} options.module - The name of the module/entity (e.g. "Company")
 * @param {String} options.action - The type of action (CREATE, UPDATE, DELETE, etc.)
 * @param {String} options.recordId - The _id of the target document
 * @param {Object} options.changes - An object describing what's changed
 */
export async function createAuditLog({
  user,
  module,
  action,
  recordId,
  changes,
}) {
  try {
    await AuditLogModel.create({
      user,
      module,
      action,
      recordId,
      changes,
    });
  } catch (error) {
    // Preferably you handle errors in a logger, not to break the main flow.
    console.error('Failed to create audit log:', error);
  }
}

export function computeDiff(oldDoc, newDoc) {
  const diff = {};
  for (const key in newDoc) {
    if (String(oldDoc[key]) !== String(newDoc[key])) {
      diff[key] = {
        old: oldDoc[key],
        new: newDoc[key],
      };
    }
  }
  return diff;
}
