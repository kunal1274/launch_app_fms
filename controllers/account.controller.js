// controllers/account.controller.js

import mongoose from "mongoose";
import { AccountModel } from "../models/account.model.js";

/**
 * Utility: validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * 1) GET ALL ACCOUNTS
 *    - Optional query param: ?includeArchived=true  (defaults to false)
 *    - Optional query param: ?hierarchy=true       (if you want nested tree)
 */
export const getAllAccounts = async (req, res) => {
  try {
    const { includeArchived, hierarchy } = req.query;
    const filter = {};

    if (includeArchived !== "true") {
      // Only fetch non-archived by default
      filter.isArchived = false;
    }

    // 1) Fetch all matching accounts
    const accounts = await AccountModel.find(filter)
      .sort({ accountCode: 1 })
      .lean();

    // 2) If user wants a hierarchical tree, build it
    if (hierarchy === "true") {
      // Build a map of id → node
      const nodeMap = {};
      accounts.forEach((acct) => {
        nodeMap[acct._id.toString()] = {
          _id: acct._id,
          accountCode: acct.accountCode,
          accountName: acct.accountName,
          type: acct.type,
          normalBalance: acct.normalBalance,
          isLeaf: acct.isLeaf,
          allowManualPost: acct.allowManualPost,
          currency: acct.currency,
          description: acct.description,
          group: acct.group,
          isArchived: acct.isArchived,
          parentAccount: acct.parentAccount,
          children: [],
        };
      });

      // Now connect children → parent
      const roots = [];
      accounts.forEach((acct) => {
        if (acct.parentAccount) {
          const parentId = acct.parentAccount.toString();
          if (nodeMap[parentId]) {
            nodeMap[parentId].children.push(nodeMap[acct._id.toString()]);
          }
        } else {
          // no parent → top‐level
          roots.push(nodeMap[acct._id.toString()]);
        }
      });

      return res.status(200).json({ status: "success", data: roots });
    }

    // 3) Otherwise return flat list
    return res.status(200).json({ status: "success", data: accounts });
  } catch (error) {
    console.error("❌ getAllAccounts Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 2) GET ONE ACCOUNT BY ID
 */
export const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findById(id).lean();
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({ status: "success", data: acct });
  } catch (error) {
    console.error("❌ getAccountById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 3) CREATE ONE ACCOUNT
 */
export const createAccount = async (req, res) => {
  try {
    const {
      accountCode,
      accountName,
      type,
      parentAccount,
      normalBalance,
      isLeaf,
      allowManualPost,
      currency,
      description,
      group,
    } = req.body;

    // Basic validation
    if (!accountCode || !accountName || !type || !normalBalance) {
      return res.status(400).json({
        status: "failure",
        message:
          "accountCode, accountName, type, and normalBalance are required.",
      });
    }

    const newAcct = new AccountModel({
      accountCode: accountCode.trim(),
      accountName: accountName.trim(),
      type,
      parentAccount: parentAccount || null,
      normalBalance,
      isLeaf: isLeaf === false ? false : true, // default true
      allowManualPost: allowManualPost === false ? false : true,
      currency: currency ? currency.trim() : "INR",
      description: description || "",
      group: group || "",
    });

    await newAcct.save();
    return res
      .status(201)
      .json({ status: "success", message: "Account created.", data: newAcct });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        status: "failure",
        message: "Duplicate accountCode. That code already exists.",
      });
    }
    console.error("❌ createAccount Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 4) BULK CREATE ACCOUNTS
 *    Expect: { data: [ { accountCode, accountName, type, … }, … ] }
 */
export const bulkCreateAccounts = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "Request body must contain a non-empty `data` array.",
      });
    }

    // Normalize each entry
    const inserts = data.map((acct) => ({
      accountCode: acct.accountCode?.trim(),
      accountName: acct.accountName?.trim(),
      type: acct.type,
      parentAccount: acct.parentAccount || null,
      normalBalance: acct.normalBalance,
      isLeaf: acct.isLeaf === false ? false : true,
      allowManualPost: acct.allowManualPost === false ? false : true,
      currency: acct.currency ? acct.currency.trim() : "INR",
      description: acct.description || "",
      group: acct.group || "",
    }));

    const inserted = await AccountModel.insertMany(inserts, { ordered: true });
    return res.status(201).json({
      status: "success",
      message: `Inserted ${inserted.length} account(s).`,
      data: inserted,
    });
  } catch (error) {
    console.error("❌ bulkCreateAccounts Error:", error);
    // If a validation error occurs, Mongoose may throw a BulkWriteError with details.
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 5) UPDATE ONE ACCOUNT BY ID
 */
export const updateAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }

    // Build an updates object only for allowed fields
    const updates = {};
    const allowedFields = [
      "accountCode",
      "accountName",
      "type",
      "parentAccount",
      "normalBalance",
      "isLeaf",
      "allowManualPost",
      "currency",
      "description",
      "group",
    ];
    for (let f of allowedFields) {
      if (f in req.body) {
        updates[f] = req.body[f];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "No valid fields supplied for update.",
      });
    }

    const updated = await AccountModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Account updated.",
      data: updated,
    });
  } catch (error) {
    console.error("❌ updateAccountById Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 6) BULK UPDATE ACCOUNTS
 *    Expect: { data: [ { _id, ...fieldsToUpdate }, ... ] }
 */
export const bulkUpdateAccounts = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Request body must contain a non-empty `data` array.");
    }

    const results = [];
    for (let entry of data) {
      const { _id, ...fields } = entry;
      if (!isValidObjectId(_id)) {
        throw new Error(`Invalid _id: ${_id}`);
      }

      // Only allow certain fields
      const updates = {};
      const allowedFields = [
        "accountCode",
        "accountName",
        "type",
        "parentAccount",
        "normalBalance",
        "isLeaf",
        "allowManualPost",
        "currency",
        "description",
        "group",
      ];
      for (let f of allowedFields) {
        if (f in fields) {
          updates[f] = fields[f];
        }
      }
      if (Object.keys(updates).length === 0) {
        throw new Error(`No valid fields to update for ID ${_id}`);
      }

      const updated = await AccountModel.findByIdAndUpdate(_id, updates, {
        new: true,
        runValidators: true,
        session,
      });
      if (!updated) {
        throw new Error(`Account not found: ${_id}`);
      }
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      status: "success",
      message: `Updated ${results.length} account(s).`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkUpdateAccounts Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 7) DELETE ONE ACCOUNT (soft-delete → archive)
 *    We set isArchived = true
 */
export const deleteAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    );
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Account archived.",
      data: acct,
    });
  } catch (error) {
    console.error("❌ deleteAccountById Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/**
 * 8) BULK DELETE ACCOUNTS (soft‐delete → archive multiple)
 *    Expect: { ids: ["id1", "id2", ...] }
 */
export const bulkDeleteAccounts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "Request body must contain a non-empty `ids` array.",
      });
    }
    // Validate each ID
    for (let id of ids) {
      if (!isValidObjectId(id)) {
        return res
          .status(400)
          .json({ status: "failure", message: `Invalid ID: ${id}` });
      }
    }
    const result = await AccountModel.updateMany(
      { _id: { $in: ids } },
      { isArchived: true }
    );
    return res.status(200).json({
      status: "success",
      message: `Archived ${result.nModified} account(s).`,
    });
  } catch (error) {
    console.error("❌ bulkDeleteAccounts Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/**
 * 9) ARCHIVE ONE (same as deleteAccountById)
 */
export const archiveAccountById = async (req, res) => {
  // alias for deleteAccountById
  return deleteAccountById(req, res);
};

/**
 * 10) UNARCHIVE ONE (restore isArchived = false)
 */
export const unarchiveAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true }
    );
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Account unarchived.",
      data: acct,
    });
  } catch (error) {
    console.error("❌ unarchiveAccountById Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};
