import mongoose from "mongoose";

import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import redisClient from "../middleware/redisClient.js";
import logger, { logStackError } from "../utility/logger.util.js";
import { StockBalanceModel } from "../models/inventStockBalance.model.js";
import { InventoryJournalModel } from "../models/inventJournal.model.js";
import { getStockTransactionsPerBalance } from "../services/getStockTransactionsPerBalance.service.js";

async function invalidateStockBalanceCache() {
  try {
    await redisClient.del("/fms/api/v0/stock-balances");
    logger.info("Cache invalidated: /fms/api/v0/stock-balances", {
      context: "invalidateStockBalanceCache",
    });
  } catch (err) {
    logStackError("❌ StockBalance cache invalidation failed", err);
  }
}

/**
 * Create a single stock-balance.
 */
export const createStockBalance = async (req, res) => {
  try {
    const data = req.body;
    if (!data.item || !data.site || !data.warehouse) {
      return res.status(422).json({
        status: "failure",
        message: "item, site and warehouse are required.",
      });
    }

    const sb = await StockBalanceModel.create(data);

    await createAuditLog({
      user: req.user?.username || "System",
      module: "StockBalance",
      action: "CREATE",
      recordId: sb._id,
      changes: { newData: sb },
    });
    await invalidateStockBalanceCache();

    return res.status(201).json({
      status: "success",
      message: "✅ StockBalance created successfully.",
      data: sb,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ StockBalance Validation Error", error);
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logStackError("❌ StockBalance Creation Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk create stock-balances.
 * Expects body = [{...}, {...}, ...]
 */
export const bulkCreateStockBalances = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message:
        "Request body must be a non-empty array of stockBalance objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const created = await StockBalanceModel.insertMany(docs, { session });

    await Promise.all(
      created.map((sb) =>
        createAuditLog({
          user: req.user?.username || "System",
          module: "StockBalance",
          action: "BULK_CREATE",
          recordId: sb._id,
          changes: { newData: sb },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateStockBalanceCache();

    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} stock balances created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create stockBalance error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk stockBalance creation.",
      error: error.message,
    });
  }
};

/**
 * Retrieve all stock-balances.
 */
export const getAllStockBalances = async (req, res) => {
  try {
    const list = await StockBalanceModel.find();
    await redisClient.set(req.originalUrl, JSON.stringify(list), { EX: 300 });
    return res
      .status(200)
      .json({ status: "success", count: list.length, data: list });
  } catch (error) {
    logStackError("❌ Get All StockBalances Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Retrieve a stock-balance by ID.
 */
export const getStockBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = await StockBalanceModel.findById(id);
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "StockBalance not found." });
    }
    return res.status(200).json({ status: "success", data: sb });
  } catch (error) {
    logStackError("❌ Get StockBalance By ID Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Update a stock-balance by ID.
 */
export const updateStockBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const sb = await StockBalanceModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "StockBalance not found." });
    }

    await createAuditLog({
      user: req.user?.username || "System",
      module: "StockBalance",
      action: "UPDATE",
      recordId: sb._id,
      changes: { newData: sb },
    });
    await invalidateStockBalanceCache();

    return res.status(200).json({
      status: "success",
      message: "✅ StockBalance updated successfully.",
      data: sb,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    logStackError("❌ Update StockBalance Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk update stock-balances.
 * Expects body = [{ _id: "...", update: {...} }, ...]
 */
export const bulkUpdateStockBalances = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "Request body must be a non-empty array of { _id, update }.  ",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results = [];
    for (const { _id, update } of updates) {
      const sb = await StockBalanceModel.findByIdAndUpdate(_id, update, {
        new: true,
        runValidators: true,
        session,
      });
      if (!sb) throw new Error(`StockBalance not found: ${_id}`);

      await createAuditLog({
        user: req.user?.username || "System",
        module: "StockBalance",
        action: "BULK_UPDATE",
        recordId: sb._id,
        changes: { newData: sb },
      });
      results.push(sb);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateStockBalanceCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} stock balances updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update stockBalance error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk stockBalance update.",
      error: error.message,
    });
  }
};

/**
 * Delete a stock-balance by ID.
 */
export const deleteStockBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const sb = await StockBalanceModel.findByIdAndDelete(id);
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "StockBalance not found." });
    }

    await createAuditLog({
      user: req.user?.username || "System",
      module: "StockBalance",
      action: "DELETE",
      recordId: sb._id,
    });
    await invalidateStockBalanceCache();

    return res
      .status(200)
      .json({ status: "success", message: "✅ StockBalance deleted." });
  } catch (error) {
    logStackError("❌ Delete StockBalance Error", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * Bulk delete stock-balances.
 * Expects body = ["id1", "id2", ...]
 */
export const bulkDeleteStockBalances = async (req, res) => {
  const ids = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "Request body must be a non-empty array of IDs.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const id of ids) {
      const sb = await StockBalanceModel.findByIdAndDelete(id, { session });
      if (!sb) throw new Error(`StockBalance not found: ${id}`);

      await createAuditLog({
        user: req.user?.username || "System",
        module: "StockBalance",
        action: "BULK_DELETE",
        recordId: sb._id,
      });
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateStockBalanceCache();

    return res.status(200).json({
      status: "success",
      message: `✅ ${ids.length} stock balances deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete stockBalance error", error);
    return res.status(500).json({
      status: "failure",
      message: "Error during bulk stockBalance delete.",
      error: error.message,
    });
  }
};

// controllers/stockBalance.controller.js

/**
 * GET /stock‐balances/provisional
 *
 * Returns, for each unique dimension combination:
 *  • The posted on-hand metrics
 *  • The aggregate deltas from all DRAFT journals (with contributor details)
 *  • The provisional metrics = posted + draft Δ
 */
export const getProvisionalStockBalances = async (req, res) => {
  const cacheKey = "stockBalances:provisional";
  try {
    // 1) Try Redis first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info("✅ Serving provisional balances from cache");
      return res.status(200).json(JSON.parse(cached));
    }
    // 1) Load all _posted_ stock balances from the DB
    const posted = await StockBalanceModel.find().lean();

    // 2) Load all journals in DRAFT status
    const drafts = await InventoryJournalModel.find({ status: "DRAFT" }).lean();

    // 3) A helper to build a unique map‐key from any "balance"‐like object
    //    We concatenate item + all 15 dimensions into a single string.
    const makeKey = (o) =>
      [
        o.item,
        o.site,
        o.warehouse,
        o.zone,
        o.location,
        o.aisle,
        o.rack,
        o.shelf,
        o.bin,
        o.config,
        o.color,
        o.size,
        o.style,
        o.version,
        o.batch,
        o.serial,
      ]
        .filter(Boolean)
        .join("|");

    // 4) We'll accumulate all draft changes in this Map
    //    key ⇒ { dims, deltaQty, deltaPurchaseValue, deltaRevenueValue, deltaCostValue, contributors[] }
    const deltaMap = new Map();

    // 5) Walk through each draft journal and each of its lines
    for (const journal of drafts) {
      for (const line of journal.lines) {
        // 5a) Build one or two "legs" depending on journal.type
        //     TRANSFER journals have TWO legs: a −qty in the FROM dims, +qty in the TO dims.
        //     Other journals have a single leg.
        const legs = [];

        if (journal.type === "TRANSFER") {
          // Leg 1: remove from the origin bin
          legs.push({
            dims: {
              item: line.item,
              site: line.from.site,
              warehouse: line.from.warehouse,
              zone: line.from.zone,
              location: line.from.location,
              aisle: line.from.aisle,
              rack: line.from.rack,
              shelf: line.from.shelf,
              bin: line.from.bin,
              config: line.config,
              color: line.color,
              size: line.size,
              style: line.style,
              version: line.version,
              batch: line.batch,
              serial: line.serial,
            },
            qtyDelta: -line.quantity,
            // priceSource = "from" indicates: “pull costPrice from this same from‐bin”
            priceSource: "from",
            journalCode: journal.code,
            lineNum: line.lineNum,
          });

          // Leg 2: add to the destination bin
          legs.push({
            dims: {
              item: line.item,
              site: line.to.site,
              warehouse: line.to.warehouse,
              zone: line.to.zone,
              location: line.to.location,
              aisle: line.to.aisle,
              rack: line.to.rack,
              shelf: line.to.shelf,
              bin: line.to.bin,
              config: line.config,
              color: line.color,
              size: line.size,
              style: line.style,
              version: line.version,
              batch: line.batch,
              serial: line.serial,
            },
            qtyDelta: +line.quantity,
            // still priceSource="from" ⇒ even the “to” leg uses the costPrice from the from‐bin
            priceSource: "from",
            journalCode: journal.code,
            lineNum: line.lineNum,
          });
        } else {
          // Non-transfer: single leg, dims chosen from either `from` or `to`
          const dims = {
            item: line.item,
            config: line.config,
            color: line.color,
            size: line.size,
            style: line.style,
            version: line.version,
            batch: line.batch,
            serial: line.serial,
            site: line.from?.site || line.to?.site,
            warehouse: line.from?.warehouse || line.to?.warehouse,
            zone: line.from?.zone || line.to?.zone,
            location: line.from?.location || line.to?.location,
            aisle: line.from?.aisle || line.to?.aisle,
            rack: line.from?.rack || line.to?.rack,
            shelf: line.from?.shelf || line.to?.shelf,
            bin: line.from?.bin || line.to?.bin,
          };

          if (line.quantity === 0 && line.loadOnInventoryValue) {
            // “load on inventory” adjustment only affects cost
            legs.push({
              dims,
              qtyDelta: 0,
              isLoad: true,
              journalCode: journal.code,
              lineNum: line.lineNum,
            });
          } else if (journal.type === "COUNTING") {
            // counting only changes quantity
            legs.push({
              dims,
              qtyDelta: line.quantity,
              isCounting: true,
              journalCode: journal.code,
              lineNum: line.lineNum,
            });
          } else {
            // normal INOUT or ADJUSTMENT
            legs.push({
              dims,
              qtyDelta: line.quantity,
              journalCode: journal.code,
              lineNum: line.lineNum,
            });
          }
        }

        // 5b) Process each leg: accumulate qtyΔ, purchaseΔ, revenueΔ, costΔ, and record contributor
        for (const leg of legs) {
          const key = makeKey(leg.dims);

          if (!deltaMap.has(key)) {
            deltaMap.set(key, {
              dims: leg.dims,
              deltaQty: 0,
              deltaPurchaseValue: 0,
              deltaRevenueValue: 0,
              deltaCostValue: 0,
              contributors: [],
            });
          }
          const acc = deltaMap.get(key);

          let purchaseDelta = 0,
            revenueDelta = 0,
            costDelta = 0;

          if (leg.isLoad) {
            // cost load/unload
            costDelta = line.loadOnInventoryValue;
          } else if (leg.isCounting) {
            // counting only changes quantity
          } else if (journal.type === "TRANSFER") {
            // always use costPrice from the “from” bin, even for the to‐leg
            const fromBin = await StockBalanceModel.findOne({
              ...leg.dims,
              site: line.from.site,
              warehouse: line.from.warehouse,
            }).lean();
            const srcCost = fromBin?.costPrice || 0;
            costDelta = leg.qtyDelta * srcCost;
          } else {
            // receipt vs issue:
            const rQty = Math.max(line.quantity, 0);
            const iQty = Math.max(-line.quantity, 0);
            purchaseDelta = rQty * line.purchasePrice;
            revenueDelta = iQty * line.salesPrice;

            // for issues, cost = existing costPrice
            const existingRec = await StockBalanceModel.findOne(
              leg.dims
            ).lean();
            const existingCost = existingRec?.costPrice || 0;
            costDelta = rQty ? purchaseDelta : -iQty * existingCost;
          }

          // accumulate
          acc.deltaQty += leg.qtyDelta;
          acc.deltaPurchaseValue += purchaseDelta;
          acc.deltaRevenueValue += revenueDelta;
          acc.deltaCostValue += costDelta;
          acc.contributors.push({
            journal: leg.journalCode,
            lineNum: leg.lineNum,
            qtyDelta: leg.qtyDelta,
            purchaseDelta,
            revenueDelta,
            costDelta,
          });
        }
      }
    }

    // 6) Merge posted + draft deltas into a provisional row set
    const result = [];

    // a) For every posted record
    for (const p of posted) {
      const key = makeKey(p);
      const d = deltaMap.get(key) || {
        deltaQty: 0,
        deltaPurchaseValue: 0,
        deltaRevenueValue: 0,
        deltaCostValue: 0,
        contributors: [],
      };

      result.push({
        ...p,
        draftDelta: d,
        provisionalQty: p.quantity + d.deltaQty,
        provisionalPurchaseValue: p.totalPurchaseValue + d.deltaPurchaseValue,
        provisionalRevenueValue: p.totalRevenueValue + d.deltaRevenueValue,
        provisionalCostValue: p.totalCostValue + d.deltaCostValue,
        provisionalCostPrice:
          (p.totalCostValue + d.deltaCostValue) /
          (p.quantity + d.deltaQty || 1),
      });
      deltaMap.delete(key);
    }

    // b) Any leftover draft‐only dims
    for (const d of deltaMap.values()) {
      result.push({
        // posted → zero
        quantity: 0,
        totalPurchaseValue: 0,
        totalRevenueValue: 0,
        totalCostValue: 0,
        costPrice: 0,
        // dims and draft
        ...d,
        provisionalQty: d.deltaQty,
        provisionalPurchaseValue: d.deltaPurchaseValue,
        provisionalRevenueValue: d.deltaRevenueValue,
        provisionalCostValue: d.deltaCostValue,
        provisionalCostPrice: d.deltaQty ? d.deltaCostValue / d.deltaQty : 0,
      });
    }

    // return res.status(200).json({
    //   status: "success",
    //   count: result.length,
    //   data: result,
    // });

    const response = { status: "success", count: result.length, data: result };

    // 3) Cache in Redis for 60s
    await redisClient.set(cacheKey, JSON.stringify(response), {
      EX: 60, // seconds
    });

    logger.info("✅ Computed & cached provisional balances");
    return res.status(200).json(response);
  } catch (err) {
    logStackError("❌ Provisional Balances Error", err);
    return res.status(500).json({
      status: "failure",
      message: "Error computing provisional balances.",
      error: err.message,
    });
  }
};

/**
 * GET /stock-transactions
 * Query params: item, site, warehouse, zone, …, serial
 */
export const getStockTransactions = async (req, res) => {
  try {
    // 1) Build a match‐function from query‐string dims:
    const dims = {};
    [
      "item",
      "site",
      "warehouse",
      "zone",
      "location",
      "aisle",
      "rack",
      "shelf",
      "bin",
      "config",
      "color",
      "size",
      "style",
      "version",
      "batch",
      "serial",
    ].forEach((key) => {
      if (req.query[key]) dims[key] = req.query[key];
    });

    // 2) Build a stable cache key from those dims
    const cacheKey =
      "stockTx:" +
      Object.entries(dims)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");

    // 3) Try to serve from Redis
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info("✅ Served stock transactions from cache");
      return res.status(200).json(JSON.parse(cached));
    }

    // 2) Fetch all journals (posted + draft) that have at least one line matching dims
    //    We do a broad find, then filter in‐JS on the flattened lines.
    const journals = await InventoryJournalModel.find({
      "lines.item": dims.item || { $exists: true },
    }).lean();

    // 3) Flatten matching lines into a unified array
    const transactions = [];
    for (const journal of journals) {
      for (const line of journal.lines) {
        // check every dimension:
        let ok = true;
        for (const [k, v] of Object.entries(dims)) {
          // line.from/line.to for storage dims; top‐level for others
          const val = [
            "site",
            "warehouse",
            "zone",
            "location",
            "aisle",
            "rack",
            "shelf",
            "bin",
          ].includes(k)
            ? journal.type === "TRANSFER"
              ? // for TRANSFER, both legs matter, but we'll just include the line once
                line.from[k] || line.to[k]
              : line.from[k] || line.to[k]
            : line[k];
          if (!val || val.toString() !== v) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        const qty = line.quantity;
        const posted = journal.status === "POSTED";
        const draft = journal.status === "DRAFT";
        const inQty = qty > 0 ? qty : 0;
        const outQty = qty < 0 ? -qty : 0;
        const purchaseV = inQty * line.purchasePrice;
        const salesV = outQty * line.salesPrice;
        const costV = posted
          ? qty >= 0
            ? purchaseV
            : -outQty * line.costPrice
          : 0;

        transactions.push({
          journalCode: journal.code,
          lineNum: line.lineNum,
          date: line.lineDate,
          postedIn: posted ? inQty : 0,
          postedOut: posted ? outQty : 0,
          draftIn: draft ? inQty : 0,
          draftOut: draft ? outQty : 0,
          purchaseValue: purchaseV,
          salesValue: salesV,
          costValue: costV,
          // we'll fill cumulative below...
        });
      }
    }

    // 4) Sort by date, then journalCode for determinism
    transactions.sort((a, b) => {
      const da = new Date(a.date),
        db = new Date(b.date);
      if (da < db) return -1;
      if (da > db) return 1;
      return a.journalCode.localeCompare(b.journalCode);
    });

    // 5) Walk once to compute running totals
    let runPostedIn = 0,
      runPostedOut = 0,
      runDraftIn = 0,
      runDraftOut = 0,
      runCost = 0,
      runPurchase = 0,
      runSales = 0;

    const ledger = transactions.map((tx) => {
      runPostedIn += tx.postedIn;
      runPostedOut += tx.postedOut;
      runDraftIn += tx.draftIn;
      runDraftOut += tx.draftOut;
      runCost += tx.costValue;
      runPurchase += tx.purchaseValue;
      runSales += tx.salesValue;

      return {
        ...tx,
        postedCumulative: runPostedIn - runPostedOut,
        draftCumulative: runDraftIn - runDraftOut,
        net: runPostedIn - runPostedOut + (runDraftIn - runDraftOut),
        cumulativeCost: runCost,
        cumulativePurchase: runPurchase,
        cumulativeSales: runSales,
      };
    });

    // return res.status(200).json({
    //   status: "success",
    //   count: ledger.length,
    //   data: ledger,
    // });

    // 7) Build response & cache it
    const response = {
      status: "success",
      count: ledger.length,
      data: ledger,
    };
    await redisClient.set(cacheKey, JSON.stringify(response), { EX: 60 });
    logger.info("✅ Computed & cached stock transactions");

    return res.status(200).json(response);
  } catch (err) {
    logStackError("❌ Stock Transactions Error", err);
    return res.status(500).json({
      status: "failure",
      message: "Could not assemble transaction ledger.",
      error: err.message,
    });
  }
};

export const getStockTransactionsForBalance1 = async (req, res) => {
  try {
    const { balanceId } = req.params;

    // 1) Look up the StockBalance record
    const sb = await StockBalanceModel.findById(balanceId).lean();
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "Stock balance not found." });
    }

    // 2) Build a dims‐object exactly like our ledger builder expects
    const dims = {
      item: sb.item.toString(),
      site: sb.site.toString(),
      warehouse: sb.warehouse.toString(),
      zone: sb.zone?.toString(),
      location: sb.location?.toString(),
      aisle: sb.aisle?.toString(),
      rack: sb.rack?.toString(),
      shelf: sb.shelf?.toString(),
      bin: sb.bin?.toString(),
      config: sb.config?.toString(),
      color: sb.color?.toString(),
      size: sb.size?.toString(),
      style: sb.style?.toString(),
      version: sb.version?.toString(),
      batch: sb.batch?.toString(),
      serial: sb.serial?.toString(),
    };

    // 3) Delegate to the same logic we use for the “/stock-transactions” endpoint
    //    It expects an object { query: { ...dims } }, so we can fake req.query:
    const fakeReq = { query: dims };
    const fakeRes = {
      status(code) {
        this._code = code;
        return this;
      },
      json(payload) {
        return payload;
      },
    };

    const ledgerPayload = await getStockTransactionsPerBalance(
      fakeReq,
      fakeRes
    );

    // 4) Return it
    return res.status(200).json({
      status: "success",
      balance: sb,
      transactions: ledgerPayload.data,
    });
  } catch (err) {
    logger.error("❌ getStockTransactionsForBalance", err);
    return res.status(500).json({
      status: "failure",
      message: "Error fetching transactions for this balance.",
      error: err.message,
    });
  }
};

export const getStockTransactionsForBalance = async (req, res) => {
  try {
    const { balanceId } = req.params;

    const cacheKey = `stockTxBalance:${balanceId}`;

    // 1) Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info("✅ Served balance‐transactions from Redis cache", {
        balanceId,
      });
      return res.status(200).json(JSON.parse(cached));
    }

    // 1) Load the StockBalance record by ID
    const sb = await StockBalanceModel.findById(balanceId).lean();
    if (!sb) {
      return res
        .status(404)
        .json({ status: "failure", message: "Stock balance not found." });
    }

    // 2) Build the exact dims object from that balance
    const dims = {
      item: sb.item.toString(),
      site: sb.site.toString(),
      warehouse: sb.warehouse.toString(),
      zone: sb.zone?.toString(),
      location: sb.location?.toString(),
      aisle: sb.aisle?.toString(),
      rack: sb.rack?.toString(),
      shelf: sb.shelf?.toString(),
      bin: sb.bin?.toString(),
      config: sb.config?.toString(),
      color: sb.color?.toString(),
      size: sb.size?.toString(),
      style: sb.style?.toString(),
      version: sb.version?.toString(),
      batch: sb.batch?.toString(),
      serial: sb.serial?.toString(),
    };

    // 3) Forge a “fake” req.query so our util can re‐use its filter logic
    const fakeReq = { query: dims };

    // 4) Delegate to the ledger‐builder util
    const ledger = await getStockTransactionsPerBalance(fakeReq);

    // 5) Return the balance + its detailed ledger
    // return res.status(200).json({
    //   status: "success",
    //   balance: sb,
    //   transactions: ledger,
    // });

    // 5) Build the full response
    const response = {
      status: "success",
      balance: sb,
      transactions: ledger,
    };

    // 6) Cache it for 60 seconds
    await redisClient.set(cacheKey, JSON.stringify(response), { EX: 60 });
    logger.info("✅ Cached balance‐transactions in Redis", { balanceId });

    return res.status(200).json(response);
  } catch (err) {
    logStackError("❌ getStockTransactionsForBalance", err);
    return res.status(500).json({
      status: "failure",
      message: "Error fetching transactions for this balance.",
      error: err.message,
    });
  }
};
