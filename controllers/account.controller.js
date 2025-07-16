// controllers/account.controller.js

import mongoose from "mongoose";
import { AccountModel } from "../models/account.model.js";
import redisClient from "../middleware/redisClient.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import { LedgerAccountCounterModel } from "../models/counter.model.js";
import { GlobalPartyModel } from "../shared_service/models/globalParty.model.js";

/**
 * Utility: validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Helper: invalidate aisle cache
const invalidateAccountCache = async (key = "/fms/api/v0/accounts") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateAccountCache",
    });
  } catch (err) {
    logStackError("❌ Account cache invalidation failed", err);
  }
};

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
      globalPartyId,
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

    // 2) Prepare a variable to hold the final partyId
    let partyId = null;

    // 3) If no globalPartyId was passed, we create a new GlobalParty doc with partyType=["Customer"].
    if (!globalPartyId) {
      const newParty = await GlobalPartyModel.create({
        name: accountCode, // or pass something else for .name
        partyType: ["Account"], // force the array to have "Customer"
      });
      partyId = newParty._id;
    } else {
      // 4) If globalPartyId is provided, we find that doc
      const existingParty = await GlobalPartyModel.findById(globalPartyId);
      if (!existingParty) {
        // Option A: Throw an error
        // return res.status(404).send({
        //   status: "failure",
        //   message: `GlobalParty with ID ${globalPartyId} does not exist.`,
        // });

        // Option B: Or create a new GlobalParty doc with that _id (rarely recommended)
        // But usually you'd want to fail if the globalPartyId doesn't exist
        return res.status(404).json({
          status: "failure",
          message: `⚠️ GlobalParty ${globalPartyId} not found. (Cannot create Account referencing missing party.)`,
        });
      }

      // 5) If found, ensure "Customer" is in the partyType array
      if (!existingParty.partyType.includes("Account")) {
        existingParty.partyType.push("Account");
        await existingParty.save();
      }

      // We'll use the existingParty's _id
      partyId = existingParty._id;
    }

    // console.log("account code", accountCode);
    const newAcct = new AccountModel({
      globalPartyId: partyId,
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

    // console.log("new Acct ", newAcct);

    await newAcct.save();
    return res
      .status(201)
      .json({ status: "success", message: "Account created.", data: newAcct });
  } catch (error) {
    console.error("❌ createAccount Error:", error);
    try {
      // const isCounterIncremented =
      //   error.message &&
      //   !error.message.startsWith("❌ Duplicate contact number");
      //if (isCounterIncremented) {
      await LedgerAccountCounterModel.findByIdAndUpdate(
        { _id: "glAccCode" },
        { $inc: { seq: -1 } }
      );
      // }
    } catch (decrementError) {
      console.error("❌ Error during counter decrement:", decrementError.stack);
    }
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    // show exactly which key is duplicated
    if (error.code === 11000) {
      console.error("❌ Duplicate key details:", error.keyValue);
      return res.status(409).json({
        status: "failure",
        message: `Duplicate ${Object.keys(error.keyValue)[0]}: ${
          Object.values(error.keyValue)[0]
        } already exists.`,
      });
    }

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

/** Delete an Aisle by ID */
export const deleteAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findByIdAndDelete(id);
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "⚠️ acct not found." });
    }

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "GL",
      action: "DELETE",
      recordId: acct._id,
    });

    await invalidateAccountCache();
    winstonLogger.info(`ℹ️ Deleted acct: ${id}`);
    return res
      .status(200)
      .json({ status: "success", message: "✅ acct deleted." });
  } catch (error) {
    logError("❌ Delete Aisle Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const archiveAccountById = async (req, res) => {
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

/** 11) BULK-DELETE ONLY “LEAF” ACCOUNTS (skip any with children) */
export const bulkAllDeleteAccounts = async (req, res) => {
  try {
    // find all parentAccount references
    const parents = await AccountModel.distinct("parentAccount", {
      parentAccount: { $ne: null },
    });
    // leaf = those _ids not in parents
    const leaves = await AccountModel.find({
      _id: { $nin: parents },
      isArchived: false,
    })
      .select("_id accountCode accountName")
      .lean();

    if (!leaves.length) {
      return res.status(200).json({
        status: "success",
        message: "No leaf accounts to delete.",
      });
    }

    const leafIds = leaves.map((a) => a._id);
    const del = await AccountModel.deleteMany({ _id: { $in: leafIds } });

    // recompute counter to max remaining systemCode
    const rem = await AccountModel.find({}, "systemCode").lean();
    let max = 0;
    rem.forEach(({ systemCode }) => {
      const m = systemCode.match(/LA_(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const reset = await LedgerAccountCounterModel.findOneAndUpdate(
      { _id: "glAccCode" },
      { seq: max },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: "success",
      message: `Deleted ${del.deletedCount} leaf account(s).`,
      deleted: leaves,
      counter: reset.seq,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/** 12) BULK-DELETE ALL ACCOUNTS (cascade) */
export const bulkAllDeleteAccountsCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const all = await AccountModel.find({}, "_id").session(session).lean();
    const ids = all.map((a) => a._id);

    if (!ids.length) {
      await session.commitTransaction();
      return res
        .status(200)
        .json({ status: "success", message: "No accounts to delete." });
    }

    await AccountModel.deleteMany({ _id: { $in: ids } }).session(session);
    // reset counter to 0
    const reset = await LedgerAccountCounterModel.findOneAndUpdate(
      { _id: "glAccCode" },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    await session.commitTransaction();
    return res.status(200).json({
      status: "success",
      message: `Cascade-deleted ${ids.length} account(s).`,
      counter: reset.seq,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  } finally {
    session.endSession();
  }
};

/** 13) TRIAL BALANCE */
export const getTrialBalance = async (req, res) => {
  try {
    const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
    const data = await GLJournalModel.aggregate([
      { $match: { voucherDate: { $lte: asOf } } },
      { $unwind: "$lines" },
      {
        $group: {
          _id: "$lines.account",
          debit: { $sum: "$lines.debit" },
          credit: { $sum: "$lines.credit" },
        },
      },
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "_id",
          as: "acct",
        },
      },
      { $unwind: "$acct" },
      {
        $project: {
          accountCode: "$acct.accountCode",
          accountName: "$acct.accountName",
          debit: 1,
          credit: 1,
          balance: { $subtract: ["$debit", "$credit"] },
        },
      },
      { $sort: { accountCode: 1 } },
    ]);
    return res.json({ status: "success", data, count: data.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/** 14) INCOME STATEMENT */
export const getIncomeStatement = async (req, res) => {
  try {
    const start = req.query.start
      ? new Date(req.query.start)
      : new Date("1900-01-01");
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const data = await GLJournalModel.aggregate([
      { $match: { voucherDate: { $gte: start, $lte: end } } },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: "accounts",
          localField: "lines.account",
          foreignField: "_id",
          as: "acct",
        },
      },
      { $unwind: "$acct" },
      { $match: { "acct.type": { $in: ["REVENUE", "EXPENSE"] } } },
      {
        $group: {
          _id: "$acct.type",
          debit: { $sum: "$lines.debit" },
          credit: { $sum: "$lines.credit" },
        },
      },
      {
        $project: {
          type: "$_id",
          amount: { $subtract: ["$credit", "$debit"] },
        },
      },
    ]);
    return res.json({ status: "success", data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/** 15) BALANCE SHEET */
export const getBalanceSheet = async (req, res) => {
  try {
    const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
    const agg = await GLJournalModel.aggregate([
      { $match: { voucherDate: { $lte: asOf } } },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: "accounts",
          localField: "lines.account",
          foreignField: "_id",
          as: "acct",
        },
      },
      { $unwind: "$acct" },
      { $match: { "acct.type": { $in: ["ASSET", "LIABILITY", "EQUITY"] } } },
      {
        $group: {
          _id: "$acct.type",
          debit: { $sum: "$lines.debit" },
          credit: { $sum: "$lines.credit" },
        },
      },
      {
        $project: {
          category: "$_id",
          balance: {
            $cond: [
              { $in: ["$_id", ["ASSET"]] },
              { $subtract: ["$debit", "$credit"] },
              { $subtract: ["$credit", "$debit"] },
            ],
          },
        },
      },
    ]);
    return res.json({ status: "success", data: agg });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/** 16) LEDGER ACCOUNT TRANSACTIONS */
export const getAccountLedger = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid account ID" });
    }
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date("1900-01-01");
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const raw = await GLJournalModel.aggregate([
      {
        $match: {
          voucherDate: { $gte: from, $lte: to },
          "lines.account": mongoose.Types.ObjectId(id),
        },
      },
      {
        $project: {
          voucherNo: 1,
          voucherDate: 1,
          line: "$lines",
        },
      },
      { $unwind: "$line" },
      { $match: { "line.account": mongoose.Types.ObjectId(id) } },
      {
        $project: {
          voucherNo: 1,
          date: "$voucherDate",
          debit: "$line.debit",
          credit: "$line.credit",
          local: "$line.localAmount",
          subledger: "$line.subledger",
        },
      },
      { $sort: { date: 1, voucherNo: 1 } },
    ]);

    // running balance
    let run = 0;
    const ledger = raw.map((r) => {
      run += r.debit - r.credit;
      return { ...r, balance: run };
    });

    return res.json({ status: "success", data: ledger });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};
