// controllers/glJournal.controller.js

import mongoose from "mongoose";
import { GLJournalModel } from "../models/glJournal.model.js";
import { AccountModel } from "../models/account.model.js";
import VoucherService from "../services/voucher.service.js";
import GLLineService from "../services/glJournalLine.service.js";
import { BankModel } from "../models/bank.model.js";
import { ItemModel } from "../models/item.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { VendorModel } from "../models/vendor.model.js";

/**
 * Helper: rounds a number to two decimals
 */
function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// const computedLines = GLLineService.compute(rawLines);

async function resolveLinkedAccount(line) {
  // if they already passed account explicitly, leave it alone:
  if (line.account) return line.account;

  // otherwise they gave us a subledger reference:
  switch (line.subledger.subledgerType) {
    case "AR":
      // look up the customer → get its linkedCoaAccount
      const cust = await CustomerModel.findById(line.customer);
      if (!cust?.linkedCoaAccount) throw new Error("Customer has no COA link");
      return cust.linkedCoaAccount;

    case "AP":
      const vend = await VendorModel.findById(line.supplier);
      if (!vend?.linkedCoaAccount) throw new Error("Vendor has no COA link");
      return vend.linkedCoaAccount;

    case "BANK":
      const ba = await BankModel.findById(line.bankAccount);
      if (!ba?.linkedCoaAccount) throw new Error("BankAccount has no COA link");
      return ba.linkedCoaAccount;

    case "INV":
      const item = await ItemModel.findById(line.item);
      if (!item?.linkedCoaAccount) throw new Error("Item has no COA link");
      return item.linkedCoaAccount;

    // …etc for other subledgers…
    default:
      throw new Error(`Unknown subledger type ${line.subledger.subledgerType}`);
  }
}

/**
 * Create a new GL Journal (balanced debit vs. credit).
 *
 * Expects request body:
 * {
 *   "journalDate"?: "2025-06-10T00:00:00.000Z",
 *   "reference"?: "string",
 *   "createdBy"?: "string",
 *   "lines": [
 *     {
 *       "accountCode": "CASH",
 *       "debit": 500,
 *       "credit": 0,
 *       "currency": "USD",
 *       "exchangeRate": 75.0,
 *       // optionally: "localAmount"
 *       // optionally: "dims": { site, warehouse, … }
 *       // optionally: "extras": {...}
 *     },
 *     {
 *       "accountCode": "SALES_REVENUE",
 *       "debit": 0,
 *       "credit": 500,
 *       "currency": "USD",
 *       "exchangeRate": 75.0
 *     }
 *   ]
 * }
 */

// controllers/glJournal.controller.js

// /** Round to two decimals */
// function roundToTwo(x) {
//   return Math.round((x + Number.EPSILON) * 100) / 100;
// }

/**
 * Create a new GL Journal (in DRAFT status)
 */

export const createGLJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      templateId,
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system",
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A GL Journal must have at least one line.");
    }

    // 1) run your tax/discount/charge computations
    const computed = GLLineService.compute(rawLines);

    const processed = [];
    for (let i = 0; i < computed.length; i++) {
      const ln = computed[i];
      let {
        account,
        debit = 0,
        credit = 0,
        currency,
        exchangeRate,
        localAmount,
        item,
        customer,
        vendor,
        bankAccount,
        dims,
        extras,
        subledger,
      } = ln;

      // 2) if no account but a subledger pointer exists, auto‐map via linkedCoaAccount
      if (!account && customer) {
        const cust = await CustomerModel.findById(customer).session(session);
        if (!cust || !cust.linkedCoaAccount) {
          throw new Error(
            `Line ${i + 1}: cannot resolve COA from customer ${customer}`
          );
        }
        account = cust.linkedCoaAccount;
      }
      if (!account && vendor) {
        const vend = await VendorModel.findById(vendor).session(session);
        if (!vend || !vend.linkedCoaAccount) {
          throw new Error(
            `Line ${i + 1}: cannot resolve COA from vendor ${vendor}`
          );
        }
        account = vend.linkedCoaAccount;
      }
      if (!account && bankAccount) {
        const ba = await BankModel.findById(bankAccount).session(session);
        if (!ba || !ba.linkedCoaAccount) {
          throw new Error(
            `Line ${i + 1}: cannot resolve COA from bankAccount ${bankAccount}`
          );
        }
        account = ba.linkedCoaAccount;
      }

      if (!account && item) {
        const it = await ItemModel.findById(item).session(session);
        if (!it || !it.linkedCoaAccount) {
          throw new Error(
            `Line ${i + 1}: cannot resolve COA from item ${item}`
          );
        }
        account = it.linkedCoaAccount;
      }

      // 3) Exactly one of {account} XOR {subledger.subledgerType} must be set
      const hasAcct = !!account;
      const hasSub = !!subledger?.subledgerType;
      if ((hasAcct ^ hasSub) !== 1) {
        throw new Error(
          `Line ${i + 1}: must supply exactly one of account or subledgerType.`
        );
      }

      // 4) If we have subledger, ensure its ID is valid
      if (hasSub) {
        if (!mongoose.isValidObjectId(subledger.txnId)) {
          throw new Error(`Line ${i + 1}: invalid subledger.txnId.`);
        }
      }

      // 5) Validate account is a leaf & manual‐postable
      if (hasAcct) {
        if (!mongoose.isValidObjectId(account)) {
          throw new Error(`Line ${i + 1}: invalid account ID.`);
        }
        const acct = await AccountModel.findById(account).session(session);
        if (!acct) {
          throw new Error(`Line ${i + 1}: account ${account} not found.`);
        }
        if (!acct.isLeaf || !acct.allowManualPost) {
          throw new Error(
            `Line ${i + 1}: cannot post to ${acct.accountCode} (leaf=${
              acct.isLeaf
            }, manual=${acct.allowManualPost}).`
          );
        }
      }

      // 6) Validate optional party/item pointers
      for (let fld of ["item", "customer", "vendor", "bankAccount"]) {
        if (ln[fld] && !mongoose.isValidObjectId(ln[fld])) {
          throw new Error(`Line ${i + 1}: invalid ${fld} ID.`);
        }
      }

      // 7) Currency & rate
      if (!currency || typeof currency !== "string") {
        throw new Error(`Line ${i + 1}: currency is required.`);
      }
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(`Line ${i + 1}: exchangeRate must be ≥ 0.`);
      }

      // 8) Exactly one of debit/credit > 0
      const d = roundToTwo(Number(debit) || 0);
      const c = roundToTwo(Number(credit) || 0);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        throw new Error(
          `Line ${i + 1}: debit and credit invalid (got ${d}/${c}).`
        );
      }

      // 9) Compute localAmount if missing
      const local =
        typeof localAmount === "number"
          ? roundToTwo(localAmount)
          : roundToTwo((d - c) * exchangeRate);

      // 10) push final line
      processed.push({
        lineNum: i + 1,
        remarks: ln.remarks || "",
        account,
        subledger,
        item,
        customer,
        vendor,
        bankAccount,
        qty: ln.qty,
        unitPrice: ln.unitPrice,
        assessableValue: ln.assessableValue,
        discountPercent: ln.discountPercent,
        chargePercent: ln.chargePercent,
        gstPercent: ln.gstPercent,
        tdsPercent: ln.tdsPercent,
        discountAmount: ln.discountAmount,
        chargesAmount: ln.chargesAmount,
        taxableValue: ln.taxableValue,
        cgst: ln.cgst,
        sgst: ln.sgst,
        igst: ln.igst,
        tdsAmount: ln.tdsAmount,
        debit: d,
        credit: c,
        currency: currency.trim(),
        exchangeRate: roundToTwo(exchangeRate),
        localAmount: local,
        dims: dims || {},
        extras: extras || {},
      });
    }

    // 4) Persist new GL Journal (still in DRAFT)
    const glj = new GLJournalModel({
      template: templateId,
      journalDate,
      status: "DRAFT",
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processed,
    });
    await glj.save({ session });

    // 5) Commit & respond
    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({ status: "success", data: glj });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ createGLJournal error:", err);
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};

export const postGLJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    if (!isValidId(id)) throw new Error("Invalid journal ID");

    const journal = await GLJournalModel.findById(id).session(session);
    if (!journal) throw new Error("Journal not found");
    if (journal.status !== "DRAFT") throw new Error("Only DRAFT can be posted");

    // change status → triggers pre‐save balance check
    journal.status = "POSTED";
    await journal.save({ session });

    await session.commitTransaction();
    return res.json({ status: "success", data: journal });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(400).json({ status: "failure", message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * 2) Get one by ID
 */
export const getGLJournalById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    const doc = await GLJournalModel.findById(id).lean();
    if (!doc)
      return res.status(404).json({ status: "failure", message: "Not found" });
    res.json({ status: "success", data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * List / search GL Journals. Supports pagination + filters.
 *
 * Query parameters:
 *   - startDate (ISO string)
 *   - endDate   (ISO string)
 *   - accountCode  (string)
 *   - createdBy    (string)
 *   - page (number, default 1)
 *   - limit (number, default 20)
 */

/**
 * Get GL Journals with various filters.
 */
export const getGLJournals = async (req, res) => {
  try {
    const {
      item,
      customer,
      vendor,
      bankAccount,
      startDate,
      endDate,
      account: accountId,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // a) Date range filter
    if (startDate || endDate) {
      filter.journalDate = {};
      if (startDate) filter.journalDate.$gte = new Date(startDate);
      if (endDate) filter.journalDate.$lte = new Date(endDate);
    }

    // b) CreatedBy filter
    if (createdBy) filter.createdBy = createdBy;

    // c) Account filter: journals that have at least one line with this accountId
    if (accountId) {
      filter["lines.account"] = mongoose.Types.ObjectId(accountId);
    }

    // d) Check if we need to filter by item, customer, vendor, or bankAccount
    ["item", "customer", "vendor", "bankAccount"].forEach((fld) => {
      if (req.query[fld] && mongoose.isValidObjectId(req.query[fld])) {
        filter[`lines.${fld}`] = mongoose.Types.ObjectId(req.query[fld]);
      }
    });

    const skip = (Number(page) - 1) * Number(limit);

    // Get total count of journals with applied filters
    const total = await GLJournalModel.countDocuments(filter);

    // Fetch the journals, sorted by journalDate, with pagination
    const journals = await GLJournalModel.find(filter)
      .sort({ journalDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(); // `lean` makes the result plain JavaScript objects, not Mongoose documents

    return res.status(200).json({
      status: "success",
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      data: journals,
    });
  } catch (err) {
    console.error("❌ getGLJournals Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * Get GL Journals with various filters, projecting only key fields.
 */
export const getGLJournalsProjection = async (req, res) => {
  try {
    const {
      item,
      customer,
      vendor,
      bankAccount,
      startDate,
      endDate,
      account: accountId,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // a) date range
    if (startDate || endDate) {
      filter.journalDate = {};
      if (startDate) filter.journalDate.$gte = new Date(startDate);
      if (endDate) filter.journalDate.$lte = new Date(endDate);
    }

    // b) createdBy
    if (createdBy) filter.createdBy = createdBy;

    // c) account filter
    if (accountId && mongoose.isValidObjectId(accountId)) {
      filter["lines.account"] = mongoose.Types.ObjectId(accountId);
    }

    // d) item/customer/vendor/bankAccount
    ["item", "customer", "vendor", "bankAccount"].forEach((fld) => {
      if (req.query[fld] && mongoose.isValidObjectId(req.query[fld])) {
        filter[`lines.${fld}`] = mongoose.Types.ObjectId(req.query[fld]);
      }
    });

    const skip = (Number(page) - 1) * Number(limit);
    const total = await GLJournalModel.countDocuments(filter);

    const journals = await GLJournalModel.find(filter)
      // ────────────────────────────────────────────────────
      // Project only the fields we actually need:
      .select({
        journalDate: 1,
        reference: 1,
        createdBy: 1,
        // lines array: include only these line‐level fields
        "lines.account": 1,
        "lines.debit": 1,
        "lines.credit": 1,
        "lines.currency": 1,
        "lines.exchangeRate": 1,
        // if you often filter by dims, include them—omit others
        "lines.dims.site": 1,
        "lines.dims.warehouse": 1,
      })
      // ────────────────────────────────────────────────────
      .sort({ journalDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      status: "success",
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      data: journals,
    });
  } catch (err) {
    console.error("❌ getGLJournals Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * 5) Update DRAFT only
 */
export const updateGLJournalById = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    if (!isValidId(id)) throw new Error("Invalid ID");
    const j = await GLJournalModel.findById(id).session(session);
    if (!j) throw new Error("Not found");
    if (j.status !== "DRAFT") throw new Error("Only DRAFT can be edited");

    // recompute lines if provided:
    if (req.body.lines) {
      // (re‐validate & recompute)
      // … same logic as create …
      const lines = GLLineService.compute(req.body.lines);
      j.lines = lines;
    }
    // allow updating reference/journalDate:
    if (req.body.reference !== undefined) j.reference = req.body.reference;
    if (req.body.journalDate) j.journalDate = req.body.journalDate;

    await j.save({ session });
    await session.commitTransaction();
    res.json({ status: "success", data: j });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * 6) Archive = CANCELLED
 */
export const archiveGLJournalById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    const j = await GLJournalModel.findById(id);
    if (!j)
      return res.status(404).json({ status: "failure", message: "Not found" });
    j.archived = true;
    await j.save();
    res.json({ status: "success", data: j });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * 7) Unarchive = back to DRAFT
 */
export const unarchiveGLJournalById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    const j = await GLJournalModel.findById(id);
    if (!j)
      return res.status(404).json({ status: "failure", message: "Not found" });
    j.archived = false;
    await j.save();
    res.json({ status: "success", data: j });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * Change status of a GL Journal (enforces per‐journal statusTransitions)
 */
export const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ status: "failure", message: "Invalid ID" });

    const glj = await GLJournalModel.findById(id);
    if (!glj)
      return res.status(404).json({ status: "failure", message: "Not found" });

    // fetch the transitions map (Map in mongoose doc)
    const allowed = Array.from(glj.statusTransitions.get(glj.status) || []);
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        status: "failure",
        message: `Cannot move from ${glj.status} → ${newStatus}`,
      });
    }

    glj.status = newStatus;
    await glj.save();
    return res.json({ status: "success", data: glj });
  } catch (err) {
    console.error("❌ changeStatus:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * 8) Bulk export (JSON dump)
 */
export const bulkExportGLJournals = async (req, res) => {
  try {
    const docs = await GLJournalModel.find().lean();
    res.json({ status: "success", count: docs.length, data: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * 9) Bulk import
 */
export const bulkImportGLJournals = async (req, res) => {
  const arr = req.body;
  if (!Array.isArray(arr) || !arr.length)
    return res.status(400).json({ status: "failure", message: "Expect array" });
  try {
    // assume each element already has valid shape
    const inserted = await GLJournalModel.insertMany(arr);
    res.json({ status: "success", count: inserted.length, data: inserted });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * 10) Bulk delete all
 */
export const bulkDeleteAllGLJournals = async (req, res) => {
  try {
    const r = await GLJournalModel.deleteMany({});
    res.json({ status: "success", deletedCount: r.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  }
};
// … your existing createGLJournal and getGLJournals here …

/**
 *  Get the approval/audit history for one GL Journal
 */
export const getGLJournalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid journal ID" });
    }
    const doc = await GLJournalModel.findById(id)
      .select("history workflow submittedAt status")
      .lean();
    if (!doc) {
      return res
        .status(404)
        .json({ status: "failure", message: "Journal not found." });
    }
    // Sort history by timestamp ascending
    doc.history.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    return res.status(200).json({ status: "success", data: doc.history });
  } catch (err) {
    console.error("❌ getGLJournalHistory Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 *  List all journals along with their workflow definitions
 *  (i.e. the stages, assigned users, statuses, etc.)
 */
export const listGLJournalWorkflows = async (req, res) => {
  try {
    const docs = await GLJournalModel.find()
      .select("_id globalJournalNum workflow")
      .lean();
    return res.status(200).json({ status: "success", data: docs });
  } catch (err) {
    console.error("❌ listGLJournalWorkflows Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
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
          totalDebit: { $sum: "$lines.debit" },
          totalCredit: { $sum: "$lines.credit" },
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
          totalDebit: 1,
          totalCredit: 1,
          balance: { $subtract: ["$totalDebit", "$totalCredit"] },
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
          _id: "$acct._id",
          accountCode: { $first: "$acct.accountCode" },
          accountName: { $first: "$acct.accountName" },
          type: { $first: "$acct.type" },
          sumDebit: { $sum: "$lines.debit" },
          sumCredit: { $sum: "$lines.credit" },
        },
      },
      {
        $addFields: {
          netAmount: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$type", "REVENUE"] },
                  then: { $subtract: ["$sumCredit", "$sumDebit"] },
                },
                {
                  case: { $eq: ["$type", "EXPENSE"] },
                  then: { $subtract: ["$sumDebit", "$sumCredit"] },
                },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { accountCode: 1 } },
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
    const data = await GLJournalModel.aggregate([
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
          _id: "$acct._id",
          accountCode: { $first: "$acct.accountCode" },
          accountName: { $first: "$acct.accountName" },
          type: { $first: "$acct.type" },
          sumDebit: { $sum: "$lines.debit" },
          sumCredit: { $sum: "$lines.credit" },
        },
      },
      {
        $addFields: {
          netBalance: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$type", "ASSET"] },
                  then: { $subtract: ["$sumDebit", "$sumCredit"] },
                },
                {
                  case: { $in: ["$type", ["LIABILITY", "EQUITY"]] },
                  then: { $subtract: ["$sumCredit", "$sumDebit"] },
                },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { accountCode: 1 } },
    ]);

    return res.json({ status: "success", data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/** 16) LEDGER ACCOUNT TRANSACTIONS */
export const getAccountLedger = async (req, res) => {
  try {
    const { accountId } = req.params;
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date("1900-01-01");
    const to = req.query.to ? new Date(req.query.to) : new Date();
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid account ID" });
    }

    // 1) Pull matching lines
    const raw = await GLJournalModel.aggregate([
      {
        $match: {
          voucherDate: { $gte: from, $lte: to },
          "lines.account": mongoose.Types.ObjectId(accountId),
        },
      },
      {
        $project: {
          journalDate: "$voucherDate",
          reference: "$reference",
          createdBy: "$createdBy",
          line: "$lines",
        },
      },
      { $unwind: "$line" },
      { $match: { "line.account": mongoose.Types.ObjectId(accountId) } },
      {
        $project: {
          journalDate: 1,
          reference: 1,
          createdBy: 1,
          debit: "$line.debit",
          credit: "$line.credit",
          localAmount: "$line.localAmount",
          currency: "$line.currency",
          exchangeRate: "$line.exchangeRate",
          subledger: "$line.subledger",
        },
      },
      { $sort: { journalDate: 1, reference: 1 } },
    ]);

    // 2) running balance
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

/*
const trialBalance = await GLJournalModel.aggregate([
  // 1) Unwind lines
  { $unwind: "$lines" },

  // 2) Group by lines.account:
  {
    $group: {
      _id: "$lines.account",
      totalDebit: { $sum: "$lines.debit" },
      totalCredit: { $sum: "$lines.credit" },
    },
  },

  // 3) Lookup account details
  {
    $lookup: {
      from: "accounts",
      localField: "_id",
      foreignField: "_id",
      as: "accountInfo",
    },
  },
  { $unwind: "$accountInfo" },

  // 4) Project the final shape
  {
    $project: {
      accountId: "$_id",
      accountCode: "$accountInfo.accountCode",
      accountName: "$accountInfo.accountName",
      type: "$accountInfo.type",
      normalBalance: "$accountInfo.normalBalance",
      sumDebit: 1,
      sumCredit: 1,
      net: { $subtract: ["$totalDebit", "$totalCredit"] },
    },
  },

  // 5) Optionally, sort by code
  { $sort: { accountCode: 1 } },
]);

const accountId = req.params.accountId; // the ObjectId of the account
const glEntries = await GLJournalModel.find(
  { "lines.account": accountId },
  { lines: 1, journalDate: 1, reference: 1, createdBy: 1 }
).lean();

// Then reshape each result to show a single row per matching line:
const ledgerRows = [];
for (let doc of glEntries) {
  // Find the single matching line in doc.lines array
  const matchingLines = doc.lines.filter(
    (l) => String(l.account) === String(accountId)
  );
  matchingLines.forEach((ln) => {
    ledgerRows.push({
      journalDate: doc.journalDate,
      reference: doc.reference,
      createdBy: doc.createdBy,
      lineDebit: ln.debit,
      lineCredit: ln.credit,
      localAmount: ln.localAmount,
      currency: ln.currency,
      exchangeRate: ln.exchangeRate,
      subledger: ln.extras.subledger || null,
      dims: ln.dims || {},
      // you can also store doc._id if you want a link to the journal itself
      journalId: doc._id,
    });
  });
}

const periodStart = new Date("2025-04-01");
const periodEnd = new Date("2025-06-30");

const incomeStatement = await GLJournalModel.aggregate([
  // 1) Unwind lines
  { $unwind: "$lines" },

  // 2) Filter by period
  {
    $match: {
      journalDate: { $gte: periodStart, $lte: periodEnd },
    },
  },

  // 3) Lookup account to get its type (REVENUE or EXPENSE)
  {
    $lookup: {
      from: "accounts",
      localField: "lines.account",
      foreignField: "_id",
      as: "acct",
    },
  },
  { $unwind: "$acct" },

  // 4) Only keep lines where acct.type in [ "REVENUE", "EXPENSE" ]
  {
    $match: {
      "acct.type": { $in: ["REVENUE", "EXPENSE"] },
    },
  },

  // 5) Group by account to compute net for each:
  {
    $group: {
      _id: "$acct._id",
      accountCode: { $first: "$acct.accountCode" },
      accountName: { $first: "$acct.accountName" },
      type: { $first: "$acct.type" },
      sumDebit: { $sum: "$lines.debit" },
      sumCredit: { $sum: "$lines.credit" },
    },
  },

  // 6) Compute net = (if REVENUE → credit − debit), if EXPENSE → debit − credit
  {
    $addFields: {
      netAmount: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$type", "REVENUE"] },
              then: { $subtract: ["$sumCredit", "$sumDebit"] },
            },
            {
              case: { $eq: ["$type", "EXPENSE"] },
              then: { $subtract: ["$sumDebit", "$sumCredit"] },
            },
          ],
          default: 0,
        },
      },
    },
  },

  // 7) Sort by accountCode
  { $sort: { accountCode: 1 } },
]);

const cutoff = new Date("2025-06-30T23:59:59.999Z");

const balanceSheet = await GLJournalModel.aggregate([
  { $unwind: "$lines" },
  { $match: { journalDate: { $lte: cutoff } } },
  {
    $lookup: {
      from: "accounts",
      localField: "lines.account",
      foreignField: "_id",
      as: "acct",
    },
  },
  { $unwind: "$acct" },
  {
    $match: {
      "acct.type": { $in: ["ASSET", "LIABILITY", "EQUITY"] },
    },
  },
  {
    $group: {
      _id: "$acct._id",
      accountCode: { $first: "$acct.accountCode" },
      accountName: { $first: "$acct.accountName" },
      type: { $first: "$acct.type" },
      sumDebit: { $sum: "$lines.debit" },
      sumCredit: { $sum: "$lines.credit" },
    },
  },
  {
    $addFields: {
      netBalance: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$type", "ASSET"] },
              then: { $subtract: ["$sumDebit", "$sumCredit"] },
            },
            {
              case: { $in: ["$type", ["LIABILITY", "EQUITY"]] },
              then: { $subtract: ["$sumCredit", "$sumDebit"] },
            },
          ],
          default: 0,
        },
      },
    },
  },
  { $sort: { accountCode: 1 } },
]);
*/

export const getGLJournals1 = async (req, res) => {
  try {
    const {
      item,
      customer,
      vendor,
      bankAccount,
      startDate,
      endDate,
      //accountCode,
      account: accountId,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // a) date range filter
    if (startDate || endDate) {
      filter.journalDate = {};
      if (startDate) filter.journalDate.$gte = new Date(startDate);
      if (endDate) filter.journalDate.$lte = new Date(endDate);
    }

    // b) createdBy filter
    if (createdBy) filter.createdBy = createdBy;

    // c) accountCode filter: journals that have at least one line with this accountCode
    // if (accountCode) {
    //   filter["lines.accountCode"] = accountCode;
    // }
    if (accountId) {
      filter["lines.account"] = mongoose.Types.ObjectId(accountId);
    }

    ["item", "customer", "vendor", "bankAccount"].forEach((fld) => {
      if (req.query[fld] && mongoose.isValidObjectId(req.query[fld])) {
        filter[`lines.${fld}`] = mongoose.Types.ObjectId(req.query[fld]);
      }
    });

    const skip = (Number(page) - 1) * Number(limit);
    const total = await GLJournalModel.countDocuments(filter);

    const journals = await GLJournalModel.find(filter)
      .sort({ journalDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      status: "success",
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      data: journals,
    });
  } catch (err) {
    console.error("❌ getGLJournals Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

export const createGLJournal1 = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system",
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A GL Journal must have at least one line.");
    }

    // 1) Validate and process each line
    const processedLines1 = rawLines.map((ln, idx) => {
      const {
        accountCode,
        //account: accountId,
        debit = 0,
        credit = 0,
        currency,
        exchangeRate,
        localAmount,
        dims,
        extras,
      } = ln;

      // 1) accountId must be a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new Error(
          `Line ${idx + 1}: account must be a valid Account _id.`
        );
      }

      // a) accountCode must be a non-empty string
      if (
        !accountCode ||
        typeof accountCode !== "string" ||
        accountCode.trim() === ""
      ) {
        throw new Error(
          `Line ${
            idx + 1
          }: accountCode is required and must be a non-empty string.`
        );
      }

      // b) currency must be a non-empty string
      if (!currency || typeof currency !== "string" || currency.trim() === "") {
        throw new Error(
          `Line ${
            idx + 1
          }: currency is required and must be a non-empty string.`
        );
      }

      // c) exchangeRate must be a number ≥ 0
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(
          `Line ${idx + 1}: exchangeRate must be a non-negative number.`
        );
      }

      // d) Exactly one of debit or credit must be > 0 (the other must be 0).
      const d = roundToTwo(Number(debit) || 0);
      const c = roundToTwo(Number(credit) || 0);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        throw new Error(
          `Line ${
            idx + 1
          }: exactly one of debit or credit must be > 0 (got debit=${d}, credit=${c}).`
        );
      }

      // e) Compute localAmount if not supplied: (debit − credit) × exchangeRate
      let computedLocal =
        typeof localAmount === "number" ? roundToTwo(localAmount) : null;
      if (computedLocal === null) {
        computedLocal = roundToTwo((d - c) * exchangeRate);
      }

      return {
        accountCode: accountCode.trim(),
        debit: d,
        credit: c,
        currency: currency.trim(),
        exchangeRate: roundToTwo(exchangeRate),
        localAmount: computedLocal,
        dims: dims || {},
        extras: extras || {},
      };
    });

    const processedLines = await Promise.all(
      rawLines.map(async (ln, idx) => {
        const {
          account,
          debit = 0,
          credit = 0,
          currency,
          exchangeRate,
          localAmount,
          // ← NEW IDs at line level
          item,
          customer,
          vendor,
          bankAccount,
          dims,
          extras,
        } = ln;

        // // 1) accountId must be a valid ObjectId
        // if (!mongoose.Types.ObjectId.isValid(accountId)) {
        //   throw new Error(
        //     `Line ${idx + 1}: account must be a valid Account _id.`
        //   );
        // }
        // validate ObjectIds if provided
        ["account", "item", "customer", "vendor", "bankAccount"].forEach(
          (fld) => {
            if (ln[fld] && !mongoose.isValidObjectId(ln[fld])) {
              throw new Error(`Line ${i + 1}: invalid ${fld} ID.`);
            }
          }
        );
        const acct = await AccountModel.findById(account);
        if (!acct) {
          throw new Error(
            `Line ${idx + 1}: Account ${account} not found in COA.`
          );
        }
        if (!acct.isLeaf || !acct.allowManualPost) {
          throw new Error(
            `Line ${idx + 1}: Cannot post to account ${
              acct.accountCode
            } because not a leaf or manual post is disallowed.`
          );
        }

        // b) currency must be a non-empty string
        if (
          !currency ||
          typeof currency !== "string" ||
          currency.trim() === ""
        ) {
          throw new Error(
            `Line ${
              idx + 1
            }: currency is required and must be a non-empty string.`
          );
        }

        // c) exchangeRate must be a number ≥ 0
        if (typeof exchangeRate !== "number" || exchangeRate < 0) {
          throw new Error(
            `Line ${idx + 1}: exchangeRate must be a non-negative number.`
          );
        }

        // d) Exactly one of debit or credit must be > 0 (the other must be 0).
        const d = roundToTwo(Number(debit) || 0);
        const c = roundToTwo(Number(credit) || 0);
        if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
          throw new Error(
            `Line ${
              idx + 1
            }: exactly one of debit or credit must be > 0 (got debit=${d}, credit=${c}).`
          );
        }

        // e) Compute localAmount if not supplied: (debit − credit) × exchangeRate
        let computedLocal =
          typeof localAmount === "number" ? roundToTwo(localAmount) : null;
        if (computedLocal === null) {
          computedLocal = roundToTwo((d - c) * exchangeRate);
        }

        return {
          account,
          debit: d,
          credit: c,
          currency: currency.trim(),
          exchangeRate: roundToTwo(exchangeRate),
          localAmount: computedLocal,
          dims: dims || {},
          extras: extras || {},
        };
      })
    );

    // 2) compute taxes/discount/charges etc
    // const lines = GLLineService.compute(rawLines);

    // 2) Build and save the GL Journal document
    const glJournal = new GLJournalModel({
      journalDate,
      status: "DRAFT",
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processedLines,
    });

    await glJournal.save({ session });

    // 2) **immediately** create the matching voucher
    await VoucherService.createJournalVoucher(glJournal, session);

    // 3) Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      data: glJournal,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ createGLJournal Error:", err);
    // If it's a Mongoose validation error, respond with 422
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};

export const createGLJournal2 = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system",
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A GL Journal must have at least one line.");
    }

    // process & validate every line
    const computedLines = GLLineService.compute(rawLines);
    const processedLines = [];
    // for (let i = 0; i < rawLines.length; i++) {
    //   const ln = rawLines[i];
    for (let i = 0; i < computedLines.length; i++) {
      const ln = computedLines[i];
      const {
        account,
        debit = 0,
        credit = 0,
        currency,
        exchangeRate,
        localAmount,
        dims,
        extras,
        item,
        customer,
        vendor,
        bankAccount,
      } = ln;

      // 1) account must be a valid ObjectId & leaf COA
      if (!mongoose.isValidObjectId(account)) {
        throw new Error(`Line ${i + 1}: invalid account ID.`);
      }
      const acct = await AccountModel.findById(account).session(session);
      if (!acct) {
        throw new Error(`Line ${i + 1}: account ${account} not found.`);
      }
      if (!acct.isLeaf || !acct.allowManualPost) {
        throw new Error(
          `Line ${i + 1}: cannot post to ${acct.accountCode} (leaf=${
            acct.isLeaf
          }, manual=${acct.allowManualPost}).`
        );
      }

      // 2) validate optional sub-ledger refs
      for (let fld of ["item", "customer", "vendor", "bankAccount"]) {
        if (ln[fld] && !mongoose.isValidObjectId(ln[fld])) {
          throw new Error(`Line ${i + 1}: invalid ${fld} ID.`);
        }
      }

      // 3) currency & rate
      if (!currency || typeof currency !== "string") {
        throw new Error(`Line ${i + 1}: currency is required.`);
      }
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(`Line ${i + 1}: exchangeRate must be ≥ 0.`);
      }

      // 4) exactly one of debit/credit > 0
      const d = roundToTwo(Number(debit) || 0);
      const c = roundToTwo(Number(credit) || 0);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        throw new Error(
          `Line ${i + 1}: one of debit or credit must be >0 (got ${d}/${c}).`
        );
      }

      // 5) compute localAmount if missing
      let local =
        typeof localAmount === "number"
          ? roundToTwo(localAmount)
          : roundToTwo((d - c) * exchangeRate);

      processedLines.push({
        account,
        debit: d,
        credit: c,
        currency: currency.trim(),
        exchangeRate: roundToTwo(exchangeRate),
        localAmount: local,
        dims: dims || {},
        extras: extras || {},
        // line‐level refs:
        item,
        customer,
        vendor,
        bankAccount,
        lineNum: i + 1,
      });
    }

    // 2) compute taxes/discount/charges etc.. how to use this ..
    //const lines = GLLineService.compute(rawLines);

    // 2) save the journal
    const glj = new GLJournalModel({
      journalDate,
      status: "DRAFT",
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processedLines,
    });
    await glj.save({ session });

    // 3) commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ status: "success", data: glj });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ createGLJournal error:", err);
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};

export const createGLJournal3 = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system",
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A GL Journal must have at least one line.");
    }

    // 1) Compute all line‐level amounts (taxes, discounts, charges, totals, etc.)
    const computedLines = GLLineService.compute(rawLines);

    // 2) Validate + enrich each computed line
    const processedLines = [];
    for (let i = 0; i < computedLines.length; i++) {
      const ln = computedLines[i];
      const {
        account,
        debit = 0,
        credit = 0,
        currency,
        exchangeRate,
        localAmount,
        item,
        customer,
        vendor,
        bankAccount,
        dims,
        extras,
      } = ln;

      // — validate account ID & that it's a leaf + manual‐postable
      if (!mongoose.isValidObjectId(account)) {
        throw new Error(`Line ${i + 1}: invalid account ID.`);
      }
      const acct = await AccountModel.findById(account).session(session);
      if (!acct) {
        throw new Error(`Line ${i + 1}: account ${account} not found.`);
      }
      if (!acct.isLeaf || !acct.allowManualPost) {
        throw new Error(
          `Line ${i + 1}: cannot post to ${acct.accountCode} (leaf=${
            acct.isLeaf
          }, manual=${acct.allowManualPost}).`
        );
      }

      // — validate optional subledger refs
      for (let fld of ["item", "customer", "vendor", "bankAccount"]) {
        if (ln[fld] && !mongoose.isValidObjectId(ln[fld])) {
          throw new Error(`Line ${i + 1}: invalid ${fld} ID.`);
        }
      }

      // — currency & rate sanity
      if (!currency || typeof currency !== "string") {
        throw new Error(`Line ${i + 1}: currency is required.`);
      }
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(`Line ${i + 1}: exchangeRate must be ≥ 0.`);
      }

      // — exactly one of debit/credit > 0
      const d = roundToTwo(Number(debit) || 0);
      const c = roundToTwo(Number(credit) || 0);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        throw new Error(
          `Line ${i + 1}: one of debit or credit must be >0 (got ${d}/${c}).`
        );
      }

      // — compute localAmount if missing
      const local =
        typeof localAmount === "number"
          ? roundToTwo(localAmount)
          : roundToTwo((d - c) * exchangeRate);

      // — build the final line object, carrying through all computed fields
      processedLines.push({
        lineNum: i + 1,
        ...ln, // bring in qty, unitPrice, assessableValue, discountAmount, cgst, tdsAmount, etc.
        debit: d,
        credit: c,
        currency: currency.trim(),
        exchangeRate: roundToTwo(exchangeRate),
        localAmount: local,
        dims: dims || {},
        extras: extras || {},
        item,
        customer,
        vendor,
        bankAccount,
      });
    }

    // 3) Persist the GL Journal in DRAFT status
    const glj = new GLJournalModel({
      journalDate,
      status: "DRAFT",
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processedLines,
    });
    await glj.save({ session });

    // 4) Commit & return
    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({ status: "success", data: glj });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ createGLJournal error:", err);
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};
