// controllers/inventoryJournal.controller.js

import mongoose from "mongoose";
// import { InventoryJournalModel } from "../models/inventoryJournal.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
// import StockBalanceService from "../services/stockBalance.service.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
// import { winstonLogger, logError } from "../utility/logError.utils.js";
import { InventoryJournalModel } from "../models/inventJournal.model.js";
// import StockBalanceService from "../services/inventStockBalance.service.js";
// import StockBalanceService from "../services/inventStockBalance.service.js";

// In-memory helper to compute a line key based on dimensions
const makeLineKey = (l) =>
  [
    l.item?.toString(),
    l.from?.site?.toString(),
    l.from?.warehouse?.toString(),
    l.config?.toString(),
    l.color?.toString(),
    l.size?.toString(),
    l.batch?.toString(),
  ]
    .filter(Boolean)
    .join("|");

// Check for duplicates within this new journal and across other DRAFT journals
async function findDraftDuplicates(lines) {
  const warnings = [];
  // within same journal
  const map = {};
  lines.forEach((line, idx) => {
    const key = makeLineKey(line);
    map[key] = map[key] || [];
    map[key].push(idx + 1);
  });
  Object.entries(map).forEach(([key, arr]) => {
    if (arr.length > 1) {
      warnings.push(
        `Duplicate line in same journal for dims ${key} at lineNumbers ${arr.join(
          ","
        )}`
      );
    }
  });
  // across other DRAFT journals
  const drafts = await InventoryJournalModel.find({ status: "DRAFT" });
  drafts.forEach((dj) => {
    dj.lines.forEach((line2, idx2) => {
      const key2 = makeLineKey(line2);
      if (map[key2]) {
        warnings.push(
          `Matches draft journal ${dj.code} line ${idx2 + 1} for dims ${key2}`
        );
      }
    });
  });
  return warnings;
}

async function invalidateJournalCache(key = "/fms/api/v0/journals") {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, {
      context: "invalidateJournalCache",
    });
  } catch (err) {
    logStackError("❌ Journal cache invalidation failed", err);
  }
}

/**
 * Create a new Inventory Journal (status defaults to DRAFT)
 */
export const createJournal = async (req, res) => {
  try {
    const {
      type,
      journalDate,
      reference,
      description,
      company,
      groups,
      lines,
    } = req.body;

    // if (!type || !company || !Array.isArray(lines) || lines.length === 0) {

    if (!type || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "type, company and non-empty lines are required.",
      });
    }

    // detect duplicates
    const warnings = await findDraftDuplicates(lines);

    const journal = new InventoryJournalModel({
      type,
      journalDate,
      reference,
      description,
      company,
      groups,
      status: "DRAFT",
      lines,
    });

    await journal.save();

    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "InventoryJournal",
      action: "CREATE",
      recordId: journal._id,
      changes: { newData: journal },
    });
    await invalidateJournalCache();

    return res.status(201).json({
      status: "success",
      message: "Journal created.",
      data: journal,
      warnings,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Journal Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logStackError("❌ Journal Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Get all journals
 */
// export const getAllJournals = async (req, res) => {
//   try {
//     const list = await InventoryJournalModel.find();
//     await redisClient.set(req.originalUrl, JSON.stringify(list), { EX: 300 });
//     return res
//       .status(200)
//       .json({ status: "success", count: list.length, data: list });
//   } catch (error) {
//     logStackError("❌ Get All Journals Error", error);
//     return res.status(500).json({
//       status: "failure",
//       message: "Internal server error.",
//       error: error.message,
//     });
//   }
// };

/**
 * Get a journal by ID
 */
// export const getJournalById = async (req, res) => {
//   try {
//     const { journalId } = req.params;
//     const journal = await InventoryJournalModel.findById(journalId);
//     if (!journal) {
//       return res
//         .status(404)
//         .json({ status: "failure", message: "Journal not found." });
//     }
//     return res.status(200).json({ status: "success", data: journal });
//   } catch (error) {
//     logStackError("❌ Get Journal By ID Error", error);
//     return res.status(500).json({
//       status: "failure",
//       message: "Internal server error.",
//       error: error.message,
//     });
//   }
// };

/**
 * Update a journal (only if DRAFT)
 */
// export const updateJournalById = async (req, res) => {
//   try {
//     const { journalId } = req.params;
//     const journal = await InventoryJournalModel.findById(journalId);
//     if (!journal) {
//       return res
//         .status(404)
//         .json({ status: "failure", message: "Journal not found." });
//     }
//     if (journal.status !== "DRAFT") {
//       return res.status(409).json({
//         status: "failure",
//         message: "Only DRAFT journals can be edited.",
//       });
//     }

//     // merge updates
//     Object.assign(journal, req.body);

//     // detect duplicates again
//     const warnings = await findDraftDuplicates(journal.lines);

//     await journal.save();
//     await createAuditLog({
//       user: req.user?.username || "67ec2fb004d3cc3237b58772",
//       module: "InventoryJournal",
//       action: "UPDATE",
//       recordId: journal._id,
//       changes: { newData: journal },
//     });
//     await invalidateJournalCache();

//     return res.status(200).json({
//       status: "success",
//       message: "Journal updated.",
//       data: journal,
//       warnings,
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       return res
//         .status(422)
//         .json({ status: "failure", message: error.message });
//     }
//     logStackError("❌ Update Journal Error", error);
//     return res.status(500).json({
//       status: "failure",
//       message: "Internal server error.",
//       error: error.message,
//     });
//   }
// };

/**
 * Delete a journal (only if DRAFT)
 */
// export const deleteJournalById = async (req, res) => {
//   try {
//     const { journalId } = req.params;
//     const journal = await InventoryJournalModel.findById(journalId);
//     if (!journal)
//       return res
//         .status(404)
//         .json({ status: "failure", message: "Journal not found." });
//     if (journal.status !== "DRAFT")
//       return res.status(409).json({
//         status: "failure",
//         message: "Only DRAFT journals can be deleted.",
//       });

//     await InventoryJournalModel.findByIdAndDelete(journalId);
//     await createAuditLog({
//       user: req.user?.username || "67ec2fb004d3cc3237b58772",
//       module: "InventoryJournal",
//       action: "DELETE",
//       recordId: journalId,
//     });
//     await invalidateJournalCache();

//     return res
//       .status(200)
//       .json({ status: "success", message: "Journal deleted." });
//   } catch (error) {
//     logStackError("❌ Delete Journal Error", error);
//     return res.status(500).json({
//       status: "failure",
//       message: "Internal server error.",
//       error: error.message,
//     });
//   }
// };

/**
 * Post a journal: apply stock changes and mark POSTED
 */
// export const postJournal = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { journalId } = req.params;
//     const journal = await InventoryJournalModel.findById(journalId).session(
//       session
//     );
//     if (!journal)
//       return res
//         .status(404)
//         .json({ status: "failure", message: "Journal not found." });
//     if (journal.status !== "DRAFT")
//       return res.status(409).json({
//         status: "failure",
//         message: "Only DRAFT journals can be posted.",
//       });

//     // apply each line to stock balances
//     await StockBalanceService.applyJournal(journal, session);

//     journal.status = "POSTED";
//     journal.postedAt = new Date();
//     await journal.save({ session });
//     await createAuditLog({
//       user: req.user?.username || "67ec2fb004d3cc3237b58772",
//       module: "InventoryJournal",
//       action: "POST",
//       recordId: journal._id,
//     });

//     await session.commitTransaction();
//     session.endSession();
//     await invalidateJournalCache();

//     return res
//       .status(200)
//       .json({ status: "success", message: "Journal posted.", data: journal });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     logStackError("❌ Post Journal Error", error);
//     return res.status(500).json({
//       status: "failure",
//       message: "Error posting journal.",
//       error: error.message,
//     });
//   }
// };

/**
 * Cancel a journal: reverse if POSTED, mark CANCELLED
 */
// export const cancelJournal = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { journalId } = req.params;
//     const journal = await InventoryJournalModel.findById(journalId).session(
//       session
//     );
//     if (!journal)
//       return res
//         .status(404)
//         .json({ status: "failure", message: "Journal not found." });
//     if (journal.status === "CANCELLED")
//       return res
//         .status(409)
//         .json({ status: "failure", message: "Already cancelled." });

//     if (journal.status === "POSTED") {
//       // reverse stock changes
//       await StockBalanceService.reverseJournal(journal, session);
//     }

//     journal.status = "CANCELLED";
//     await journal.save({ session });
//     await createAuditLog({
//       user: req.user?.username || "67ec2fb004d3cc3237b58772",
//       module: "InventoryJournal",
//       action: "CANCEL",
//       recordId: journal._id,
//     });

//     await session.commitTransaction();
//     session.endSession();
//     await invalidateJournalCache();

//     return res.status(200).json({
//       status: "success",
//       message: "Journal cancelled.",
//       data: journal,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     logStackError("❌ Cancel Journal Error", error);
//     return res.status(500).json({
//       status: "failure",
//       message: "Error cancelling journal.",
//       error: error.message,
//     });
//   }
// };
