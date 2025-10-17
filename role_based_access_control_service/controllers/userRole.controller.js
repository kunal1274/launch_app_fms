// controllers/userRole.controller.js
import { UserRoleModel } from "../models/userRole.model.js";
import { UserGlobalModel } from "../../models/userGlobal.model.js";

/**
 * Create a user role
 */
export const createUserRole = async (req, res) => {
  try {
    const { name, permissions = [], scopes = {} } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const newRole = new UserRoleModel({ name, permissions, scopes });
    await newRole.save();

    return res.status(201).json(newRole);
  } catch (error) {
    console.error("Error in createUserRole:", error);
    return res.status(500).json({ message: "Failed to create user role" });
  }
};

/**
 * Get all user roles
 */
export const getAllUserRoles = async (req, res) => {
  try {
    // Optionally populate permissions if you want to see them
    const roles = await UserRoleModel.find().populate("permissions");
    return res.json(roles);
  } catch (error) {
    console.error("Error in getAllUserRoles:", error);
    return res.status(500).json({ message: "Failed to fetch user roles" });
  }
};

/**
 * Get a user role by ID
 */
export const getUserRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await UserRoleModel.findById(id).populate("permissions");
    if (!role) {
      return res.status(404).json({ message: "User role not found" });
    }
    return res.json(role);
  } catch (error) {
    console.error("Error in getUserRoleById:", error);
    return res.status(500).json({ message: "Error fetching user role" });
  }
};

/**
 * Update a user role
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, scopes } = req.body;

    const updatedRole = await UserRoleModel.findByIdAndUpdate(
      id,
      { name, permissions, scopes },
      { new: true }
    ).populate("permissions");

    if (!updatedRole) {
      return res.status(404).json({ message: "User role not found" });
    }

    return res.json(updatedRole);
  } catch (error) {
    console.error("Error in updateUserRole:", error);
    return res.status(500).json({ message: "Failed to update user role" });
  }
};

/**
 * Delete a user role
 *
 * We must ensure no user references this user role in `UserGlobalModel.userRoles`.
 */
export const deleteUserRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any user references this role
    const referencingUsers = await UserGlobalModel.find({
      userRoles: id,
    });
    if (referencingUsers.length > 0) {
      return res.status(400).json({
        message: "Cannot delete Role. It's referenced by one or more Users.",
      });
    }

    const deleted = await UserRoleModel.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "User role not found" });
    }

    return res.json({ message: "User role deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUserRole:", error);
    return res.status(500).json({ message: "Failed to delete user role" });
  }
};

// controllers/userRole.controller.js (continued)

// Assign permissions to a user role
export const assignPermissionsToRole = async (req, res) => {
  try {
    const { roleId } = req.params; // URL param, e.g. /roles/:roleId/permissions
    const { permissionIds } = req.body; // array of permission _ids to add

    const role = await UserRoleModel.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "User role not found" });
    }

    // Merge new permission IDs with existing ones
    // Alternatively, replace them entirely, depending on the use-case
    const existing = new Set(role.permissions.map((id) => id.toString()));
    permissionIds.forEach((pid) => existing.add(pid));

    role.permissions = Array.from(existing);
    await role.save();

    // Optionally populate to return updated data
    const updatedRole = await UserRoleModel.findById(roleId).populate(
      "permissions"
    );
    return res.json(updatedRole);
  } catch (error) {
    console.error("Error in assignPermissionsToRole:", error);
    return res.status(500).json({ message: "Failed to assign permissions" });
  }
};

// Remove permission(s) from a user role
export const removePermissionsFromRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body; // array of permission _ids to remove

    const role = await UserRoleModel.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "User role not found" });
    }

    const updatedList = role.permissions.filter(
      (pid) => !permissionIds.includes(pid.toString())
    );
    role.permissions = updatedList;
    await role.save();

    const updatedRole = await UserRoleModel.findById(roleId).populate(
      "permissions"
    );
    return res.json(updatedRole);
  } catch (error) {
    console.error("Error in removePermissionsFromRole:", error);
    return res.status(500).json({ message: "Failed to remove permissions" });
  }
};
