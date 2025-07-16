// controllers/bank.controller.js

import mongoose from "mongoose";
import { BankModel } from "../models/bank.model.js";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * 1) GET ALL BANKS
 *    Query params:
 *      - includeArchived=true  (optional; default: false)
 *      - hierarchy=true        (optional; default: false)
 */
export const getAllBanks = async (req, res) => {
  try {
    const { includeArchived, hierarchy } = req.query;
    const filter = {};

    if (includeArchived !== "true") {
      filter.isArchived = false;
    }

    const banks = await BankModel.find(filter).sort({ accountCode: 1 }).lean();

    if (hierarchy === "true") {
      // Build a map of id → node
      const nodeMap = {};
      banks.forEach((b) => {
        nodeMap[b._id.toString()] = {
          _id: b._id,
          accountCode: b.accountCode,
          bankName: b.bankName,
          children: [],
        };
      });

      const roots = [];
      banks.forEach((b) => {
        if (b.parentAccount) {
          const pid = b.parentAccount.toString();
          if (nodeMap[pid]) {
            nodeMap[pid].children.push(nodeMap[b._id.toString()]);
          }
        } else {
          roots.push(nodeMap[b._id.toString()]);
        }
      });

      return res.status(200).json({ status: "success", data: roots });
    }

    return res.status(200).json({ status: "success", data: banks });
  } catch (error) {
    console.error("❌ getAllBanks Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 2) GET ONE BANK BY ID
 */
export const getBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }
    const bank = await BankModel.findById(id).lean();
    if (!bank) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({ status: "success", data: bank });
  } catch (error) {
    console.error("❌ getBankById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 3) CREATE ONE BANK
 */
export const createBank = async (req, res) => {
  try {
    const {
      systemCode,
      accountCode,
      type,
      parentAccount,
      linkedCoaAccount,
      upi,
      bankName,
      accountHolderName,
      ifsc,
      swift,
      active,
      qrDetails,
      isLeaf,
      currency,
      description,
      ledgerGroup,
    } = req.body;

    // Basic checks
    if (!type || !linkedCoaAccount || !currency) {
      return res.status(400).json({
        status: "failure",
        message:
          "Fields `type`, `linkedCoaAccount` (ObjectId), and `currency` are required.",
      });
    }
    if (!isValidObjectId(linkedCoaAccount)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid linkedCoaAccount ID." });
    }
    if (parentAccount && !isValidObjectId(parentAccount)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid parentAccount ID." });
    }

    const newBank = new BankModel({
      systemCode: systemCode || null,
      accountCode: accountCode ? accountCode.trim() : undefined,
      type,
      parentAccount: parentAccount || null,
      linkedCoaAccount,
      upi: upi || "",
      bankName: bankName || "",
      accountHolderName: accountHolderName || "",
      ifsc: ifsc || "",
      swift: swift || "",
      active: active === true,
      qrDetails: qrDetails || "",
      isLeaf: isLeaf === false ? false : true,
      currency,
      description: description || "",
      ledgerGroup: ledgerGroup || "",
    });

    await newBank.save();
    return res
      .status(201)
      .json({ status: "success", message: "Bank created.", data: newBank });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        status: "failure",
        message:
          "Duplicate accountCode. That bank account code already exists.",
      });
    }
    console.error("❌ createBank Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 4) BULK CREATE BANKS
 *    Expects: { data: [ { /* bank fields *\/ }, ... ] }
 */
export const bulkCreateBanks = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "Request body must contain a non-empty `data` array.",
      });
    }

    const inserts = data.map((b) => {
      // Basic normalization
      return {
        systemCode: b.systemCode || null,
        accountCode: b.accountCode ? b.accountCode.trim() : undefined,
        type: b.type,
        parentAccount: b.parentAccount || null,
        linkedCoaAccount: b.linkedCoaAccount,
        upi: b.upi || "",
        bankName: b.bankName || "",
        accountHolderName: b.accountHolderName || "",
        ifsc: b.ifsc || "",
        swift: b.swift || "",
        active: b.active === true,
        qrDetails: b.qrDetails || "",
        isLeaf: b.isLeaf === false ? false : true,
        currency: b.currency,
        description: b.description || "",
        ledgerGroup: b.ledgerGroup || "",
      };
    });

    // Insert many (one failure aborts entire batch)
    const inserted = await BankModel.insertMany(inserts, { ordered: true });
    return res.status(201).json({
      status: "success",
      message: `Inserted ${inserted.length} bank(s).`,
      data: inserted,
    });
  } catch (error) {
    console.error("❌ bulkCreateBanks Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 5) UPDATE ONE BANK BY ID
 */
export const updateBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }

    // Only allow certain fields to be updated
    const allowedFields = [
      "systemCode",
      "accountCode",
      "type",
      "parentAccount",
      "linkedCoaAccount",
      "upi",
      "bankName",
      "accountHolderName",
      "ifsc",
      "swift",
      "active",
      "qrDetails",
      "isLeaf",
      "currency",
      "description",
      "ledgerGroup",
      "isArchived",
    ];
    const updates = {};
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

    // Validate object IDs if present
    if (updates.parentAccount && !isValidObjectId(updates.parentAccount)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid parentAccount ID." });
    }
    if (
      updates.linkedCoaAccount &&
      !isValidObjectId(updates.linkedCoaAccount)
    ) {
      return res.status(400).json({
        status: "failure",
        message: "Invalid linkedCoaAccount ID.",
      });
    }

    const updated = await BankModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Bank updated.",
      data: updated,
    });
  } catch (error) {
    console.error("❌ updateBankById Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 6) BULK UPDATE BANKS
 *    Expects: { data: [ { _id, /* fields *\/ }, … ] }
 */
export const bulkUpdateBanks = async (req, res) => {
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

      const allowedFields = [
        "systemCode",
        "accountCode",
        "type",
        "parentAccount",
        "linkedCoaAccount",
        "upi",
        "bankName",
        "accountHolderName",
        "ifsc",
        "swift",
        "active",
        "qrDetails",
        "isLeaf",
        "currency",
        "description",
        "ledgerGroup",
        "isArchived",
      ];
      const updates = {};
      for (let f of allowedFields) {
        if (f in fields) {
          updates[f] = fields[f];
        }
      }
      if (Object.keys(updates).length === 0) {
        throw new Error(`No valid fields to update for ID ${_id}`);
      }

      if (updates.parentAccount && !isValidObjectId(updates.parentAccount)) {
        throw new Error(`Invalid parentAccount ID: ${updates.parentAccount}`);
      }
      if (
        updates.linkedCoaAccount &&
        !isValidObjectId(updates.linkedCoaAccount)
      ) {
        throw new Error(
          `Invalid linkedCoaAccount ID: ${updates.linkedCoaAccount}`
        );
      }

      const updated = await BankModel.findByIdAndUpdate(_id, updates, {
        new: true,
        runValidators: true,
        session,
      });
      if (!updated) {
        throw new Error(`Bank not found: ${_id}`);
      }
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      status: "success",
      message: `Updated ${results.length} bank(s).`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkUpdateBanks Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 7) “DELETE” ONE BANK (soft‐delete → archive)
 *    Set isArchived = true
 */
export const deleteBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }
    const bank = await BankModel.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    );
    if (!bank) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Bank archived.",
      data: bank,
    });
  } catch (error) {
    console.error("❌ deleteBankById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 8) BULK DELETE BANKS (soft‐delete → archive)
 *    Expects: { ids: [ "id1", "id2", … ] }
 */
export const bulkDeleteBanks = async (req, res) => {
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
    const result = await BankModel.updateMany(
      { _id: { $in: ids } },
      { isArchived: true }
    );
    return res.status(200).json({
      status: "success",
      message: `Archived ${result.nModified} bank(s).`,
    });
  } catch (error) {
    console.error("❌ bulkDeleteBanks Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/**
 * 9) ARCHIVE ONE BANK (alias for deleteBankById)
 */
export const archiveBankById = async (req, res) => {
  return deleteBankById(req, res);
};

/**
 * 10) UNARCHIVE ONE BANK
 */
export const unarchiveBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }
    const bank = await BankModel.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true }
    );
    if (!bank) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Bank unarchived.",
      data: bank,
    });
  } catch (error) {
    console.error("❌ unarchiveBankById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

// e.g. compute balance for one BankAccount at any moment:
const now = new Date();

const agg = await GLJournalModel.aggregate([
  { $unwind: "$lines" },
  {
    $match: {
      "lines.account": bankAcc.linkedCoaAccount,
      voucherDate: { $lte: now },
    },
  },
  {
    $group: {
      _id: null,
      netForeignBalance: {
        $sum: { $subtract: ["$lines.debit", "$lines.credit"] },
      },
      netLocalBalance: { $sum: "$lines.localAmount" },
    },
  },
]);

const foreignBalance = agg.length ? agg[0].netForeignBalance : 0;
const localBalance = agg.length ? agg[0].netLocalBalance : 0;

export const getBankAccountBalance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const ba = await BankAccountModel.findById(id);
    if (!ba) {
      return res.status(404).json({ status: "failure", message: "Not found" });
    }

    const now = new Date();
    const agg = await GLJournalModel.aggregate([
      { $unwind: "$lines" },
      {
        $match: {
          "lines.account": ba.linkedCoaAccount,
          voucherDate: { $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          netForeignBalance: {
            $sum: { $subtract: ["$lines.debit", "$lines.credit"] },
          },
          netLocalBalance: { $sum: "$lines.localAmount" },
        },
      },
    ]);

    const foreignBalance = agg.length ? agg[0].netForeignBalance : 0;
    const localBalance = agg.length ? agg[0].netLocalBalance : 0;

    return res.status(200).json({
      status: "success",
      data: {
        bankAccount: ba,
        foreignBalance,
        localBalance,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};
