// controllers/userGlobal.controller.js
import { UserGlobalModel } from "../models/userGlobal.model.js";
import { GlobalPartyModel } from "../shared_service/models/globalParty.model.js";
import createGlobalPartyId from "../shared_service/utility/createGlobalParty.utility.js";

/**
 * Create a user
 */

export const createUserGlobal = async (req, res) => {
  try {
    const {
      email,
      password,
      phoneNumber,
      name,
      method,
      signInMethod,
      globalPartyId,
    } = req.body;

    // Basic validations, adapt as needed
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ message: "Either email or phoneNumber is required" });
    }

    // Additional checks, e.g. password, etc.
    const partyId = await createGlobalPartyId(
      "User",
      globalPartyId,
      email ? email : phoneNumber
    );

    const user = new UserGlobalModel({
      email,
      password,
      phoneNumber,
      name,
      method,
      signInMethod,
      globalPartyId: partyId,
    });

    await user.save();
    return res.status(201).json(user);
  } catch (error) {
    console.error("Error in createUserGlobal:", error);
    return res.status(500).json({ message: "Failed to create user" });
  }
};

/**
 * Get all users
 */
export const getAllUsersGlobal = async (req, res) => {
  try {
    // Optionally populate userRoles to see them
    const users = await UserGlobalModel.find().populate("userRoles");
    return res.json(users);
  } catch (error) {
    console.error("Error in getAllUsersGlobal:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

/**
 * Get a user by ID
 */
export const getUserGlobalById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserGlobalModel.findById(id).populate("userRoles");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    console.error("Error in getUserGlobalById:", error);
    return res.status(500).json({ message: "Error fetching user" });
  }
};

/**
 * Update a user
 */
export const updateUserGlobal = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email,
      password,
      phoneNumber,
      name,
      method,
      signInMethod,
      userRoles,
    } = req.body;

    const updatedUser = await UserGlobalModel.findByIdAndUpdate(
      id,
      {
        email,
        password,
        phoneNumber,
        name,
        method,
        signInMethod,
        // Optionally update userRoles if provided
        ...(userRoles && { userRoles }),
      },
      { new: true }
    ).populate("userRoles");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(updatedUser);
  } catch (error) {
    console.error("Error in updateUserGlobal:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
};

/**
 * Delete a user
 */
export const deleteUserGlobal = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await UserGlobalModel.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUserGlobal:", error);
    return res.status(500).json({ message: "Failed to delete user" });
  }
};

// controllers/userGlobal.controller.js (continued)

/**
 * Assign user roles to a user
 */
export const assignRolesToUser = async (req, res) => {
  try {
    const { userId } = req.params; // e.g. /users/:userId/roles
    const { roleIds } = req.body; // array of role _ids to add

    const user = await UserGlobalModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Merge new role IDs with existing ones
    const existing = new Set(user.userRoles.map((id) => id.toString()));
    roleIds.forEach((rid) => existing.add(rid));

    user.userRoles = Array.from(existing);
    await user.save();

    const updatedUser = await UserGlobalModel.findById(userId).populate(
      "userRoles"
    );
    return res.json(updatedUser);
  } catch (error) {
    console.error("Error in assignRolesToUser:", error);
    return res.status(500).json({ message: "Failed to assign roles to user" });
  }
};

/**
 * Remove user roles from a user
 */
export const removeRolesFromUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleIds } = req.body; // array of role _ids to remove

    const user = await UserGlobalModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedList = user.userRoles.filter(
      (rid) => !roleIds.includes(rid.toString())
    );
    user.userRoles = updatedList;
    await user.save();

    const updatedUser = await UserGlobalModel.findById(userId).populate(
      "userRoles"
    );
    return res.json(updatedUser);
  } catch (error) {
    console.error("Error in removeRolesFromUser:", error);
    return res.status(500).json({ message: "Failed to remove roles" });
  }
};
