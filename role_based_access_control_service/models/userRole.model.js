// models/userRole.model.js
import mongoose from 'mongoose';

const userRoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permissions: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Permissions',
    default: [],
  }, //["READ_CUSTOMER", "UPDATE_CUSTOMER"],
  scopes: {
    type: mongoose.Schema.Types.Mixed, // e.g. { CUSTOMER: { region: 'domestic', status : 'active' }, ITEM: {...} }
    default: {},
  },
});

export const UserRoleModel = mongoose.model('UserRoles', userRoleSchema);
