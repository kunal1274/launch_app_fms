import createError from "http-errors";
import {
  SalesOrderModel,
  STATUS_TRANSITIONS,
  generateDeliveryId,
  generateInvoicingId,
  generatePaymentId,
  getDaysFromPaymentTerm,
  generateShipmentId,
} from "../models/bb3SalesOrder.model.js";
// import { streamCSV, streamXLSX } from "../utils/exporter.js";
import multer from "multer";
// import { importCSV, importXLSX } from "../utils/importer.js";
//import { enqueue } from "../config/queue.js";
import { computeStatus, totals } from "../utils/bb3OrderStatus.js";

const upload = multer({ dest: "uploads/" });

/*------------- helpers------------------------*/
// helper to find one and attach to res.locals for downstream middleware
export const loadById = async (req, res, next, id) => {
  try {
    const so = await SalesOrderModel.findById(id);
    if (!so) return next(createError(404, "Sales order not found"));
    res.locals.currentSO = so;
    req.salesOrder = so;
    next();
  } catch (err) {
    next(err);
  }
};

/* shared internal */
const VALID_COL = { shippingQty: 1, deliveringQty: 1, invoicingQty: 1 };

async function mutateMovement(req, res, next, mutator) {
  try {
    const { id, col, rid } = req.params; // rid means row id .

    // ── 1) Validate which sub‑array you’re touching
    if (!VALID_COL[col]) return next(createError(400, "bad collection"));

    // ── 2) Load the parent SalesOrder document
    const so = await SalesOrderModel.findById(id);

    // ── 3) Locate the exact sub‑document by its row id
    const row = so[col].id(rid);
    if (!row) return next(createError(404, "row not found"));

    // ── 4) Apply the custom mutation (post or cancel)
    mutator(row);

    // ── 5) Recompute the overall order status
    //     (e.g. “PartiallyShipped”, “Shipped”, etc.)
    //     based on updated totals in that array
    so.status = computeStatus(totals(so));

    // ── 6) Persist and return the updated SalesOrder
    await so.save();
    res.json(so);
  } catch (e) {
    next(e);
  }
}

/** return shipped / delivered / invoiced / ordered totals */
// it will be replaced by totals(so) which is imported by utils
function qtyTotals(so) {
  const shipped = so.shippingQty.reduce((n, r) => n + r.qty, 0);
  const delivered = so.deliveringQty.reduce((n, r) => n + r.qty, 0);
  const invoiced = so.invoicingQty.reduce((n, r) => n + r.qty, 0);
  return { shipped, delivered, invoiced, ordered: so.quantity };
}

/* ---------- CRUD ---------- */

export const list = async (req, res, next) => {
  try {
    const { filter, page, limit, sort } = req.qp;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      SalesOrderModel.find(filter).sort(sort).skip(skip).limit(limit),
      SalesOrderModel.countDocuments(filter),
    ]);

    res.json({
      data: items,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const so = await SalesOrderModel.create(req.body);
    res.status(201).json(so);
  } catch (err) {
    next(err);
  }
};

export const read = async (req, res, next) => {
  try {
    const so = req.salesOrder || res.locals.currentSO;
    if (!so) return next(createError(404, "Sales order not found"));
    res.json(so);
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const so = await SalesOrderModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    res.json(so);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await SalesOrderModel.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

/* ---------- archive toggle ---------- */

export const toggleArchive = async (req, res, next) => {
  try {
    const so = await SalesOrderModel.findByIdAndUpdate(
      req.params.id,
      { archived: !!req.body.archived },
      { new: true }
    );
    res.json(so);
  } catch (err) {
    next(err);
  }
};

/* ---------- process‑flow action endpoint ---------- */
/*-------router.patch("/:id/actions/:actionName", ctl.triggerAction);------*/

export const triggerAction = async (req, res, next) => {
  const { actionName } = req.params;
  const so = req.salesOrder;

  const ACTION_MAP = {
    approve: "Approved",
    reject: "Rejected",
    confirm: "Confirmed",
    ship: "Shipped", // track partial shipped based on shipping qty vs so qty
    deliver: "Delivered", // track partial delivery based on delivery qty vs shipping qty
    invoice: "Invoiced", // track partial invoicing based on invoice qty vs delivery qty
    cancel: "Cancelled",
    admin: "AdminMode",
    any: "AnyMode",
    draft: "Draft",
    none: "None",
  };

  const nextStatus = ACTION_MAP[actionName];
  if (!nextStatus) return next(createError(400, "⚠️ Unknown action"));

  // custom guard
  if (!STATUS_TRANSITIONS[so.status]?.includes(nextStatus))
    return next(createError(400, `❌ Cannot ${actionName} from ${so.status}`));

  /* if computation says we are partial, override */
  const dynStatus = computeStatus(totals(so));
  if (
    ["PartiallyShipped", "PartiallyDelivered", "PartiallyInvoiced"].includes(
      dynStatus
    )
  ) {
    so.status = dynStatus;
  } else {
    so.status = nextStatus;
  }
  await so.save();
  res.json(so);
};

/* ---------- helpers -------------------------------------------------- */

/* ---------- PATCH /sales‑orders/:id/actions/:actionName/data ---------- */
/**
 * body = { qty, mode, ref, date }
 * actionName = ship | deliver | invoice
 * – pushes a sub‑document + flips status in one call
 */
export const triggerActionWithData_V1 = async (req, res, next) => {
  try {
    const { actionName } = req.params;
    const { qty, mode, ref, date } = req.body;
    const so = req.salesOrder; // loaded via .param
    const map = {
      ship: { key: "shippingQty", status: "Shipped" },
      deliver: { key: "deliveringQty", status: "Delivered" },
      invoice: { key: "invoicingQty", status: "Invoiced" },
    };
    const cfg = map[actionName];
    if (!cfg) return next(createError(400, "⚠️ Unknown action"));

    /* transition guard */
    if (!STATUS_TRANSITIONS[so.status]?.includes(cfg.status))
      return next(
        createError(400, `❌ Cannot ${actionName} from ${so.status}`)
      );

    /* remaining qty check */
    const t = qtyTotals(so);
    const remain =
      actionName === "ship"
        ? t.ordered - t.shipped
        : actionName === "deliver"
        ? t.shipped - t.delivered
        : t.delivered - t.invoiced;

    if (qty <= 0 || qty > remain)
      return next(
        createError(400, `❌ Qty out of range (remaining ${remain})`)
      );

    /* compose sub‑doc */
    const sub =
      actionName === "ship"
        ? { qty, shipmentMode: mode, extShipmentId: ref, date }
        : actionName === "deliver"
        ? { qty, deliveryMode: mode, extDeliveryId: ref, date }
        : { qty, paymentTerms: mode, extInvoiceId: ref, invoiceDate: date };

    so[cfg.key].push(sub);
    so.status = cfg.status;
    await so.save();
    res.json(so);
  } catch (e) {
    next(e);
  }
};
// now with totals(so) replacing qtyTotals(so)
/*--------router.patch("/:id/actions/:actionName/data", ctl.triggerActionWithData);--------*/
export const triggerActionWithData = async (req, res, next) => {
  try {
    const { actionName } = req.params;
    const { qty, mode, ref, date, autoPost = false } = req.body;
    const so = req.salesOrder; // loaded via .param

    const ACTION_MAP = {
      approve: "Approved",
      reject: "Rejected",
      confirm: "Confirmed",
      ship: "Shipped" || "PartiallyShipped", // track partial shipped based on shipping qty vs so qty
      deliver: "Delivered", // track partial delivery based on delivery qty vs shipping qty
      invoice: "Invoiced", // track partial invoicing based on invoice qty vs delivery qty
      cancel: "Cancelled",
      admin: "AdminMode",
      any: "AnyMode",
      draft: "Draft",
      none: "None",
    };

    const nextStatus = ACTION_MAP[actionName];
    if (!nextStatus)
      return next(createError(400, "⚠️ Unknown action in Action Mapping"));

    // custom guard
    if (!STATUS_TRANSITIONS[so.status]?.includes(nextStatus))
      return next(
        createError(400, `❌ Cannot ${actionName} from ${so.status}`)
      );

    /* map action -> collection helpers */
    const MAP = {
      ship: {
        col: "shippingQty",
        genId: generateShipmentId,
        modeKey: "shipmentMode",
        refKey: "extShipmentId",
      },
      deliver: {
        col: "deliveringQty",
        genId: generateDeliveryId,
        modeKey: "deliveryMode",
        refKey: "extDeliveryId",
      },
      invoice: {
        col: "invoicingQty",
        genId: generateInvoicingId,
        modeKey: "paymentTerms",
        refKey: "extInvoiceId",
      },
    };
    const cfg = MAP[actionName];
    if (!cfg)
      return next(createError(400, "⚠️ Unknown action in Movement Mapping"));

    // /* transition guard */
    // if (!STATUS_TRANSITIONS[so.status]?.includes(cfg.status))
    //   return next(
    //     createError(400, `❌ Cannot ${actionName} from ${so.status}`)
    //   );

    // /* remaining qty check */
    // const t = qtyTotals(so);
    // const remain =
    //   actionName === "ship"
    //     ? t.ordered - t.shipped
    //     : actionName === "deliver"
    //     ? t.shipped - t.delivered
    //     : t.delivered - t.invoiced;

    /* remaining qty check – only POSTED movements reduce remaining */
    const t = totals(so);
    const remain =
      actionName === "ship"
        ? t.ordered - t.shipped
        : actionName === "deliver"
        ? t.shipped - t.delivered
        : t.delivered - t.invoiced;

    //previous version
    // if (qty <= 0 || qty > remain)
    //   return next(
    //     createError(400, `❌ Qty out of range (remaining ${remain})`)
    //   );

    if (qty <= 0 || qty > remain)
      return next(
        createError(400, `❌ Qty out of range (remaining ${remain})`)
      );

    // /* compose sub‑doc */
    // const sub =
    //   actionName === "ship"
    //     ? { qty, shipmentMode: mode, extShipmentId: ref, date }
    //     : actionName === "deliver"
    //     ? { qty, deliveryMode: mode, extDeliveryId: ref, date }
    //     : { qty, paymentTerms: mode, extInvoiceId: ref, invoiceDate: date };

    /* build new sub‑doc */
    const sub = {
      qty,
      [cfg.modeKey]: mode,
      [cfg.refKey]: ref || "NA",
      date: date || new Date(),
      status: autoPost ? "Posted" : "Draft",
      ...((await cfg.genId())
        ? {
            [cfg.col === "shippingQty"
              ? "shipmentId"
              : cfg.col === "deliveringQty"
              ? "deliveryId"
              : "invoicingId"]: await cfg.genId(),
          }
        : {}),
    };

    // so[cfg.key].push(sub);
    so[cfg.col].push(sub);

    // so.status = cfg.status;
    /* only adjust header status if we actually POSTED qty */
    if (autoPost) {
      so.status = computeStatus(totals(so));
    }

    await so.save();
    res.json(so);
  } catch (e) {
    next(e);
  }
};

export const addPayment = async (req, res, next) => {
  try {
    const { amount, paymentMode, transactionId, date = new Date() } = req.body;
    if (!amount || amount <= 0) return next(createError(400, "⚠️ amount?"));

    const so = req.salesOrder;
    so.paidAmt.push({ amount, paymentMode, transactionId, date });
    so.updateSettlementStatus(); // method from the model
    await so.save();
    res.json(so);
  } catch (e) {
    next(e);
  }
};

/* ---------- POST /sales‑orders/:id/movements/:col/:rid/post ---------- */
export const postMovement = async (req, res, next) => {
  mutateMovement(req, res, next, (row) => {
    // only flip a “Draft” row to “Posted”
    if (row.status === "Draft") {
      row.status = "Posted";
    }
  });
};

/* ----------  PATCH /sales-orders/:id/movements/:col/:rid/cancel  ---------- */
export const cancelMovement = async (req, res, next) => {
  mutateMovement(req, res, next, (row) => {
    // unconditionally cancel it .
    row.status = "Cancelled";
  });
};

/* ---------- export ---------- */

/*
export const uploadSingle = upload.single("file");

export const exportFile = async (req, res, next) => {
  try {
    const { format = "csv" } = req.query;
    if (format === "xlsx") return streamXLSX(res, req.qp?.filter || {});
    return streamCSV(res, req.qp?.filter || {});
  } catch (e) {
    next(e);
  }
};
*/

/* ---------- import ---------- */
/*
export const importFile = async (req, res, next) => {
  try {
    const { file } = req;
    if (!file) throw new Error("No file uploaded");

    // enqueue heavy job
    //enqueue?.("import", { path: file.path, mimetype: file.mimetype });

    res.json({ message: "Import queued, you will be notified." });
  } catch (e) {
    next(e);
  }
};
*/

/* ---------- stats aggregation ---------- */
/*
export const stats = async (req, res, next) => {
  try {
    const { groupBy = "status", period = "all" } = req.query;
    const match = {};
    if (period !== "all") {
      const from =
        period === "thisWeek"
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      match.createdAt = { $gte: from };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: `$${groupBy}`,
          total: { $sum: "$netAmtAfterTax" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ];
    const data = await SalesOrder.aggregate(pipeline);
    res.json(data);
  } catch (e) {
    next(e);
  }
};
*/
