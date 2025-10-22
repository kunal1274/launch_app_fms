// controllers/permission.controller.js
import { PermissionModel } from '../models/permission.model.js';
import { UserRoleModel } from '../models/userRole.model.js';

/**
 * Create a Permission
 */
export const createPermission = async (req, res) => {
  try {
    const { key, description, module, area } = req.body;

    // Basic validation
    if (!key && !module) {
      return res
        .status(400)
        .json({ message: 'Permission key and module are required' });
    }

    // Create new permission
    const newPermission = new PermissionModel({
      key,
      description,
      module,
      area,
    });
    await newPermission.save();

    return res.status(201).json(newPermission);
  } catch (error) {
    console.error('Error in createPermission:', error);
    return res.status(500).json({ message: 'Failed to create permission' });
  }
};

/**
 * Get all permissions
 */
export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await PermissionModel.find();
    return res.json(permissions);
  } catch (error) {
    console.error('Error in getAllPermissions:', error);
    return res.status(500).json({ message: 'Failed to fetch permissions' });
  }
};

/**
 * Get a single permission by ID
 */
export const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await PermissionModel.findById(id);
    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }
    return res.json(permission);
  } catch (error) {
    console.error('Error in getPermissionById:', error);
    return res.status(500).json({ message: 'Error fetching permission' });
  }
};

/**
 * Update a permission
 */
export const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { key, description, module, area } = req.body;

    const updatedPermission = await PermissionModel.findByIdAndUpdate(
      id,
      { key, description, module, area },
      { new: true }
    );
    if (!updatedPermission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    return res.json(updatedPermission);
  } catch (error) {
    console.error('Error in updatePermission:', error);
    return res.status(500).json({ message: 'Failed to update permission' });
  }
};

/**
 * Delete a permission
 *
 * We must ensure the permission is not referenced by any UserRole.
 */
export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if any user role references this permission
    const referencingRoles = await UserRoleModel.find({ permissions: id });
    if (referencingRoles.length > 0) {
      return res.status(400).json({
        message:
          'Cannot delete Permission. It\'s referenced by one or more UserRoles.',
      });
    }

    const deleted = await PermissionModel.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    return res.json({ message: 'Permission deleted successfully' });
  } catch (error) {
    console.error('Error in deletePermission:', error);
    return res.status(500).json({ message: 'Failed to delete permission' });
  }
};

/**
 * Bulk create permissions
 * Expects req.body to be an array of { key, description, module, area }
 */
export const bulkCreatePermissions = async (req, res) => {
  try {
    const permissionsArray = req.body;

    if (!Array.isArray(permissionsArray) || permissionsArray.length === 0) {
      return res
        .status(400)
        .json({ message: 'Request body must be a non-empty array.' });
    }

    // Basic validation: each item must have key & module
    for (const perm of permissionsArray) {
      if (!perm.key || !perm.module) {
        return res.status(400).json({
          message: 'Each permission requires at least \'key\' and \'module\'.',
        });
      }
    }

    // Insert them
    // By default, insertMany is "ordered: true" which means if one doc fails,
    // it stops inserting the rest. You can set "ordered: false" to insert all valid docs.
    const inserted = await PermissionModel.insertMany(permissionsArray, {
      ordered: true,
    });

    return res.status(201).json({
      message: 'Permissions inserted successfully',
      data: inserted,
    });
  } catch (error) {
    console.error('Error in bulkCreatePermissions:', error);
    // If it's a duplicate key error, you might want to parse it carefully
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Some permission(s) already exist (duplicate key error).',
        error: error.message,
      });
    }
    return res
      .status(500)
      .json({ message: 'Failed to bulk-insert permissions.', error });
  }
};

/**
 * Bulk update permissions
 * Expects req.body = array of { _id, key, description, module, area }
 */
export const bulkUpdatePermissions = async (req, res) => {
  try {
    const updates = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res
        .status(400)
        .json({ message: 'Request body must be a non-empty array.' });
    }

    const updatePromises = updates.map(async (updateDoc) => {
      if (!updateDoc._id) {
        throw new Error('Each item requires an _id to be updated.');
      }
      const { _id, ...rest } = updateDoc;
      return PermissionModel.findByIdAndUpdate(_id, rest, { new: true });
    });

    // `Promise.all` will reject if any update throws.
    const results = await Promise.all(updatePromises);

    // Filter out null if something wasn't found
    const notFound = results.filter((doc) => doc === null);
    if (notFound.length > 0) {
      return res.status(404).json({
        message: 'Some permissions were not found for updating.',
        notFoundCount: notFound.length,
      });
    }

    return res.json({
      message: 'Bulk update successful',
      data: results,
    });
  } catch (error) {
    console.error('Error in bulkUpdatePermissions:', error);
    return res
      .status(500)
      .json({ message: 'Failed to bulk-update permissions.', error });
  }
};

/**
 * Bulk delete permissions
 * Expects req.body = { ids: [ <permissionId1>, <permissionId2> ... ] }
 */
export const bulkDeletePermissions = async (req, res) => {
  try {
    const { ids } = req.body; // e.g. { "ids": ["64b...", "64c..."] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: 'Request body must contain \'ids\' array.' });
    }

    // 1) Check references for each ID in UserRole
    // We can do it one by one or do a single query. Let’s do it in bulk:
    const referencingRoles = await UserRoleModel.find({
      permissions: { $in: ids },
    });
    if (referencingRoles.length > 0) {
      // This means at least one of the given permission IDs is in use
      return res.status(400).json({
        message:
          'Cannot delete. One or more permissions are referenced by user roles.',
        referencingRoles,
      });
    }

    // 2) If no references, we can delete all in one go
    const deleteResult = await PermissionModel.deleteMany({
      _id: { $in: ids },
    });
    // deleteResult.deletedCount tells how many were actually found & removed

    return res.json({
      message: 'Bulk delete successful',
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error('Error in bulkDeletePermissions:', error);
    return res
      .status(500)
      .json({ message: 'Failed to bulk-delete permissions.', error });
  }
};

/**
 * Bulk operations with partial success.
 * Expects req.body to be an array of operations like:
 * [
 *   { action: "create", data: { key, description, module, ... } },
 *   { action: "update", data: { _id, key, description, module, ... } },
 *   { action: "delete", data: { _id } }
 * ]
 */
export const bulkOperationsPartial = async (req, res) => {
  try {
    const operations = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({
        message: 'Request body must be a non-empty array of operations.',
      });
    }

    // We'll store results in this array. Each element has { index, action, success, dataOrError }
    const results = [];

    // Process each operation in a for-loop or with Promise.allSettled.
    // We'll do a for...of loop for clarity, so we can handle them sequentially.
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const { action, data } = op;

      // Prepare a result object we can fill
      const resultItem = {
        index: i, // which item in the request
        action,
        success: false, // assume failure until we succeed
        dataOrError: null,
      };

      try {
        if (!action || !data) {
          throw new Error('Each operation requires \'action\' and \'data\'.');
        }

        // 1) CREATE
        if (action === 'create') {
          // Basic validation
          if (!data.key || !data.module) {
            throw new Error('For \'create\', \'key\' and \'module\' are required.');
          }
          const createdDoc = await PermissionModel.create(data);
          resultItem.success = true;
          resultItem.dataOrError = createdDoc;
        }

        // 2) UPDATE
        else if (action === 'update') {
          if (!data._id) {
            throw new Error('For \'update\', \'_id\' is required in \'data\'.');
          }

          // Attempt update
          const { _id, ...fields } = data;
          const updatedDoc = await PermissionModel.findByIdAndUpdate(
            _id,
            fields,
            { new: true }
          );

          if (!updatedDoc) {
            throw new Error(`Permission with _id=${_id} not found.`);
          }

          resultItem.success = true;
          resultItem.dataOrError = updatedDoc;
        }

        //“create if _id doesn’t exist, otherwise update.
        else if (action === 'upsert') {
          if (data._id) {
            // update
            const updated = await PermissionModel.findByIdAndUpdate(
              data._id,
              data,
              { new: true }
            );
            if (!updated) {
              // If doc doesn't exist, we can create a new doc with the same _id if that's allowed
              const createdDoc = await PermissionModel.create({
                ...data,
                _id: data._id,
              });
              resultItem.dataOrError = createdDoc;
            } else {
              resultItem.dataOrError = updated;
            }
          } else {
            // create
            const newDoc = await PermissionModel.create(data);
            resultItem.dataOrError = newDoc;
          }
          resultItem.success = true;
        }

        // 3) DELETE
        else if (action === 'delete') {
          if (!data._id) {
            throw new Error('For \'delete\', \'_id\' is required in \'data\'.');
          }

          // 3a) Check references in UserRole
          const referencingRoles = await UserRoleModel.find({
            permissions: data._id,
          });
          if (referencingRoles.length > 0) {
            throw new Error(
              `Permission _id=${data._id} is referenced by one or more UserRoles.`
            );
          }

          // 3b) Delete
          const deletedDoc = await PermissionModel.findByIdAndDelete(data._id);
          if (!deletedDoc) {
            throw new Error(
              `Permission with _id=${data._id} not found or already deleted.`
            );
          }

          resultItem.success = true;
          resultItem.dataOrError = {
            message: 'Permission deleted successfully',
            _id: data._id,
          };
        }

        // If action is none of the above
        else {
          throw new Error(
            `Unknown action '${action}'. Valid actions are 'create', 'update', 'upsert','delete'.`
          );
        }
      } catch (opError) {
        // This operation failed, but we keep going
        resultItem.success = false;
        resultItem.dataOrError = opError.message || opError.toString();
      }

      results.push(resultItem);
    }

    // Return all results

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return res.json({
      message: `Bulk operations done. ${successCount} succeeded, ${failCount} failed.`,
      results,
    });
  } catch (error) {
    console.error('bulkOperationsPartial error:', error);
    return res.status(500).json({
      message: 'Failed to process bulk operations.',
      error: error.message,
    });
  }
};
