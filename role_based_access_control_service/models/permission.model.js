// models/permission.model.js
import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  description: String,
  module: { type: String, required: true },
  area: { type: String, default: 'Common' },
});

export const PermissionModel = mongoose.model('Permissions', permissionSchema);
