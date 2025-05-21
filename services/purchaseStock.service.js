// services/purchaseStock.service.js

import { StockBalanceModel } from "../models/inventStockBalance.model.js";
import { ProvisionalBalanceModel } from "../models/provisionalBalance.model.js";
import { InventoryTransactionModel } from "../models/inventoryTransaction.model.js";

class PurchaseStockService1 {
  static async reservePO(po, session) {
    for (let i = 0; i < po.lines.length; i++) {
      const l = po.lines[i];
      const qty = po.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: po.site,
        warehouse: po.warehouse,
        // … copy any other dims you track on PO line …
        zone: po.zone,
        location: po.location,
        aisle: po.aisle,
        rack: po.rack,
        shelf: po.shelf,
        bin: po.bin,
        config: po.config,
        color: po.color,
        size: po.size,
        style: po.style,
        version: po.version,
        batch: po.batch,
        serial: po.serial,
      };

      const pb = await ProvisionalBalanceModel.findOneAndUpdate(
        key,
        { $inc: { quantity: qty, totalReserveValue: qty * l.price } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );

      // tag with reference
      pb.extras = pb.extras || new Map();
      pb.extras.set("refType", "PurchaseOrder");
      pb.extras.set("refId", po._id.toString());
      pb.extras.set("refNum", po.orderNum);
      pb.extras.set("refLineNum", i + 1);
      await pb.save({ session });
    }
  }

  static async releasePO(po, session) {
    for (let i = 0; i < po.lines.length; i++) {
      const l = po.lines[i];
      const qty = po.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: po.site,
        warehouse: po.warehouse,
        zone: po.zone,
        location: po.location,
        aisle: po.aisle,
        rack: po.rack,
        shelf: po.shelf,
        bin: po.bin,
        config: po.config,
        color: po.color,
        size: po.size,
        style: po.style,
        version: po.version,
        batch: po.batch,
        serial: po.serial,
      };
      const pb = await ProvisionalBalanceModel.findOne(key).session(session);
      if (!pb) continue;
      pb.quantity -= qty;
      pb.totalReserveValue -= qty * l.price;
      await pb.save({ session });
    }
  }

  static async applyPO(po, session) {
    for (let i = 0; i < po.lines.length; i++) {
      const l = po.lines[i];
      const qty = po.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: po.site,
        warehouse: po.warehouse,
        zone: po.zone,
        location: po.location,
        aisle: po.aisle,
        rack: po.rack,
        shelf: po.shelf,
        bin: po.bin,
        config: po.config,
        color: po.color,
        size: po.size,
        style: po.style,
        version: po.version,
        batch: po.batch,
        serial: po.serial,
      };
      const sb = await StockBalanceModel.findOneAndUpdate(
        key,
        {
          $inc: {
            quantity: qty,
            totalCostValue: qty * l.price,
            totalPurchaseValue: qty > 0 ? qty * l.price : 0,
            totalRevenueValue: qty < 0 ? -qty * l.price : 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
      // recompute moving‐average
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;

      // tag reference
      sb.extras = sb.extras || new Map();
      sb.extras.set("refType", "PurchaseOrder");
      sb.extras.set("refId", po._id.toString());
      sb.extras.set("refNum", po.orderNum);
      sb.extras.set("refLineNum", i + 1);
      await sb.save({ session });
    }
  }

  static async reversePO(po, session) {
    for (let i = 0; i < po.lines.length; i++) {
      const l = po.lines[i];
      const qty = po.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: po.site,
        warehouse: po.warehouse,
        zone: po.zone,
        location: po.location,
        aisle: po.aisle,
        rack: po.rack,
        shelf: po.shelf,
        bin: po.bin,
        config: po.config,
        color: po.color,
        size: po.size,
        style: po.style,
        version: po.version,
        batch: po.batch,
        serial: po.serial,
      };
      const sb = await StockBalanceModel.findOne(key).session(session);
      if (!sb) throw new Error("Stock record not found for reversal");
      sb.quantity -= qty;
      sb.totalCostValue -= qty * l.price;
      sb.totalPurchaseValue -= qty > 0 ? qty * l.price : 0;
      sb.totalRevenueValue -= qty < 0 ? -qty * l.price : 0;
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      await sb.save({ session });
    }
  }
}

// for single  item
class PurchaseStockService2 {
  static async reservePO1(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const key = {
      item: po.item,
      site: po.site,
      warehouse: po.warehouse,
      // … copy any other dims you track on PO line …
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };

    // const pb = await ProvisionalBalanceModel.findOneAndUpdate(
    //   key,
    //   { $inc: { quantity: qty, totalReserveValue: qty * po.price } },
    //   { upsert: true, new: true, setDefaultsOnInsert: true, session }
    // );

    // prepare the $inc object
    const update = {
      $inc: {
        quantity: qty,
        totalReserveValue: qty * po.price,
      },
      $set: {
        // stamp your PO reference fields into extras
        "extras.refType": "PurchaseOrder",
        "extras.refId": po._id.toString(),
        "extras.refNum": po.orderNum,
        "extras.refLineNum": (1).toString(),
      },
    };

    // let pb;
    // try {
    //   // first try upsert
    //   pb = await ProvisionalBalanceModel.findOneAndUpdate(key, update, {
    //     upsert: true,
    //     new: true,
    //     setDefaultsOnInsert: true,
    //     session,
    //   });
    // } catch (err) {
    //   if (err.code === 11000) {
    //     // race condition: somebody else inserted first
    //     pb = await ProvisionalBalanceModel.findOneAndUpdate(key, update, {
    //       upsert: false,
    //       new: true,
    //       session,
    //     });
    //   } else {
    //     throw err;
    //   }
    // }

    // // tag with reference
    // pb.extras = pb.extras || new Map();
    // pb.extras.set("refType", "PurchaseOrder");
    // pb.extras.set("refId", po._id.toString());
    // pb.extras.set("refNum", po.orderNum);
    // pb.extras.set("refLineNum", 1);
    // await pb.save({ session });

    // Try upsert first, catch 11000 if someone raced you
    try {
      await ProvisionalBalanceModel.findOneAndUpdate(key, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        session,
      });
    } catch (err) {
      if (err.code === 11000) {
        // duplicate‐key race: retry without upsert
        await ProvisionalBalanceModel.findOneAndUpdate(key, update, {
          new: true,
          session,
        });
      } else {
        throw err;
      }
    }
  }

  static async reservePO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const value = qty * po.price;

    const key = {
      item: po.item,
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };

    const update = {
      $inc: {
        quantity: qty,
        totalReserveValue: value,
      },
      // stamp your PO reference into the `extras` map
      $set: {
        "extras.refType": "PurchaseOrder",
        "extras.refId": po._id.toString(),
        "extras.refNum": po.orderNum,
        "extras.refLineNum": "1",
      },
    };

    try {
      await ProvisionalBalanceModel.updateOne(key, update, {
        session,
        upsert: true,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate-key race: retry without upsert
        await ProvisionalBalanceModel.updateOne(key, update, { session });
      } else {
        throw err;
      }
    }
  }

  static async releasePO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const key = {
      item: po.item,
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };
    const pb = await ProvisionalBalanceModel.findOne(key).session(session);
    if (!pb) return;
    pb.quantity -= qty;
    pb.totalReserveValue -= qty * po.price;
    await pb.save({ session });
  }

  static async applyPO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const key = {
      item: po.item,
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };
    const sb = await StockBalanceModel.findOneAndUpdate(
      key,
      {
        $inc: {
          quantity: qty,
          totalCostValue: qty * po.price,
          totalPurchaseValue: qty > 0 ? qty * po.price : 0,
          totalRevenueValue: qty < 0 ? -qty * po.price : 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
    // recompute moving‐average
    sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;

    // tag reference
    sb.extras = sb.extras || new Map();
    sb.extras.set("refType", "PurchaseOrder");
    sb.extras.set("refId", po._id.toString());
    sb.extras.set("refNum", po.orderNum);
    sb.extras.set("refLineNum", 1);
    await sb.save({ session });
  }

  static async reversePO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const key = {
      item: po.item,
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };
    const sb = await StockBalanceModel.findOne(key).session(session);
    if (!sb) throw new Error("Stock record not found for reversal");
    sb.quantity -= qty;
    sb.totalCostValue -= qty * po.price;
    sb.totalPurchaseValue -= qty > 0 ? qty * po.price : 0;
    sb.totalRevenueValue -= qty < 0 ? -qty * po.price : 0;
    sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
    await sb.save({ session });
  }
}

class PurchaseStockServiceSingleLine {
  /**
   * Reserve inventory for a Purchase Order (Confirmed).
   * qty positive for normal PO, negative for Return.
   */
  static async reservePO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const value = qty * po.price;
    const dims = {
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };

    // 1) Upsert provisional balance
    await ProvisionalBalanceModel.updateOne(
      { item: po.item, ...dims },
      {
        $inc: { quantity: qty, totalReserveValue: value },
        $set: {
          "extras.refType": "PurchaseOrder",
          "extras.refId": po._id.toString(),
          "extras.refNum": po.orderNum,
          "extras.refLineNum": "1",
        },
      },
      { upsert: true, session }
    );

    // 2) Log transaction
    await InventoryTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: "PURCHASE",
          sourceId: po._id,
          sourceLine: 1,
          item: po.item,
          dims,
          qty,
          costPrice: 0, // no cost on reserve
          purchasePrice: po.price,
          salesPrice: 0,
          transferPrice: 0,
          taxes: { gst: 0, withholdingTax: 0 },
          extras: { action: "RESERVE", refNum: po.orderNum },
        },
      ],
      { session }
    );
  }

  /**
   * Release a previously‐reserved PO (back to Draft/Cancelled).
   */
  static async releasePO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const value = qty * po.price;
    const dims = {
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };

    // 1) Decrement provisional
    const pb = await ProvisionalBalanceModel.findOne(
      { item: po.item, ...dims },
      null,
      { session }
    );
    if (pb) {
      pb.quantity -= qty;
      pb.totalReserveValue -= value;
      await pb.save({ session });
    }

    // 2) Log transaction
    await InventoryTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: "PURCHASE",
          sourceId: po._id,
          sourceLine: 1,
          item: po.item,
          dims,
          qty: -qty, // negative of the reserve
          costPrice: 0,
          purchasePrice: po.price,
          salesPrice: 0,
          transferPrice: 0,
          taxes: { gst: 0, withholdingTax: 0 },
          extras: { action: "RELEASE", refNum: po.orderNum },
        },
      ],
      { session }
    );
  }

  /**
   * Apply (post) a Purchase Order → real stock receipt (or return).
   */
  static async applyPO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const price = po.price;
    const dims = {
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };

    // 1) Upsert real stock
    const sb = await StockBalanceModel.findOneAndUpdate(
      { item: po.item, ...dims },
      {
        $inc: {
          quantity: qty,
          totalCostValue: qty * price,
          totalPurchaseValue: qty > 0 ? qty * price : 0,
          totalRevenueValue: qty < 0 ? -qty * price : 0,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    // recalc moving‐average cost
    sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
    // tag PO refs
    sb.extras = sb.extras || new Map();
    sb.extras.set("refType", "PurchaseOrder");
    sb.extras.set("refId", po._id.toString());
    sb.extras.set("refNum", po.orderNum);
    sb.extras.set("refLineNum", "1");
    await sb.save({ session });

    // 2) Log transaction
    await InventoryTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: "PURCHASE",
          sourceId: po._id,
          sourceLine: 1,
          item: po.item,
          dims,
          qty,
          costPrice: sb.costPrice,
          purchasePrice: price,
          salesPrice: 0,
          transferPrice: 0,
          taxes: { gst: 0, withholdingTax: 0 },
          extras: {
            action: po.orderType === "Return" ? "RETURN" : "RECEIPT",
            refNum: po.orderNum,
          },
        },
      ],
      { session }
    );
  }

  /**
   * Reverse a posted Purchase Order (return an invoice) → undo the real stock change.
   */
  static async reversePO(po, session) {
    const qty = po.orderType === "Return" ? -po.quantity : po.quantity;
    const price = po.price;
    const dims = {
      site: po.site,
      warehouse: po.warehouse,
      zone: po.zone,
      location: po.location,
      aisle: po.aisle,
      rack: po.rack,
      shelf: po.shelf,
      bin: po.bin,
      config: po.config,
      color: po.color,
      size: po.size,
      style: po.style,
      version: po.version,
      batch: po.batch,
      serial: po.serial,
    };

    // 1) Decrement real stock
    const sb = await StockBalanceModel.findOne({
      item: po.item,
      ...dims,
    }).session(session);
    if (!sb) throw new Error("Stock record not found for reversal");
    sb.quantity -= qty;
    sb.totalCostValue -= qty * price;
    sb.totalPurchaseValue -= qty > 0 ? qty * price : 0;
    sb.totalRevenueValue -= qty < 0 ? -qty * price : 0;
    sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
    await sb.save({ session });

    // 2) Log transaction
    await InventoryTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: "PURCHASE",
          sourceId: po._id,
          sourceLine: 1,
          item: po.item,
          dims,
          qty: -qty,
          costPrice: sb.costPrice,
          purchasePrice: price,
          salesPrice: 0,
          transferPrice: 0,
          taxes: { gst: 0, withholdingTax: 0 },
          extras: {
            action:
              po.orderType === "Return"
                ? "RETURN_REVERSAL"
                : "RECEIPT_REVERSAL",
            refNum: po.orderNum,
          },
        },
      ],
      { session }
    );
  }
}

// services/purchaseStock.service.js

class PurchaseStockService {
  /**
   * Reserve inventory for a Purchase Order (Confirmed).
   * Loops through order.lines[] (or single root line if no array).
   */
  static async reservePO(order, session) {
    const lines = Array.isArray(order.lines)
      ? order.lines
      : [
          {
            item: order.item,
            quantity: order.quantity,
            price: order.price,
            site: order.site,
            warehouse: order.warehouse,
            zone: order.zone,
            location: order.location,
            aisle: order.aisle,
            rack: order.rack,
            shelf: order.shelf,
            bin: order.bin,
            config: order.config,
            color: order.color,
            size: order.size,
            style: order.style,
            version: order.version,
            batch: order.batch,
            serial: order.serial,
          },
        ];

    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx];
      const qty = order.orderType === "Return" ? -ln.quantity : ln.quantity;
      const val = qty * ln.price;
      const dims = {
        site: ln.site,
        warehouse: ln.warehouse,
        zone: ln.zone,
        location: ln.location,
        aisle: ln.aisle,
        rack: ln.rack,
        shelf: ln.shelf,
        bin: ln.bin,
        config: ln.config,
        color: ln.color,
        size: ln.size,
        style: ln.style,
        version: ln.version,
        batch: ln.batch,
        serial: ln.serial,
      };

      // 1) Upsert provisional balance
      await ProvisionalBalanceModel.updateOne(
        { item: ln.item, ...dims },
        {
          $inc: { quantity: qty, totalReserveValue: val },
          $set: {
            "extras.refType": "PurchaseOrder",
            "extras.refId": order._id.toString(),
            "extras.refNum": order.orderNum,
            "extras.refLineNum": (idx + 1).toString(),
          },
        },
        { upsert: true, session }
      );

      // 2) Log transaction
      await InventoryTransactionModel.create(
        [
          {
            txnDate: new Date(),
            sourceType: "PURCHASE",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty,
            costPrice: 0,
            purchasePrice: ln.price,
            salesPrice: 0,
            transferPrice: 0,
            taxes: { gst: 0, withholdingTax: 0 },
            extras: { action: "RESERVE", refNum: order.orderNum },
          },
        ],
        { session }
      );
    }
  }

  static async releasePO(order, session) {
    const lines = Array.isArray(order.lines)
      ? order.lines
      : [
          {
            item: order.item,
            quantity: order.quantity,
            price: order.price,
            site: order.site,
            warehouse: order.warehouse,
            zone: order.zone,
            location: order.location,
            aisle: order.aisle,
            rack: order.rack,
            shelf: order.shelf,
            bin: order.bin,
            config: order.config,
            color: order.color,
            size: order.size,
            style: order.style,
            version: order.version,
            batch: order.batch,
            serial: order.serial,
          },
        ];

    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx];
      const qty = order.orderType === "Return" ? -ln.quantity : ln.quantity;
      const val = qty * ln.price;
      const dims = { /* same as above */ ...ln };

      // decrement provisional
      const pb = await ProvisionalBalanceModel.findOne(
        { item: ln.item, ...dims },
        null,
        { session }
      );
      if (pb) {
        pb.quantity -= qty;
        pb.totalReserveValue -= val;
        await pb.save({ session });
      }

      // log transaction
      await InventoryTransactionModel.create(
        [
          {
            txnDate: new Date(),
            sourceType: "PURCHASE",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty: -qty,
            costPrice: 0,
            purchasePrice: ln.price,
            salesPrice: 0,
            transferPrice: 0,
            taxes: { gst: 0, withholdingTax: 0 },
            extras: { action: "RELEASE", refNum: order.orderNum },
          },
        ],
        { session }
      );
    }
  }

  static async applyPO(order, session) {
    const lines = Array.isArray(order.lines)
      ? order.lines
      : [
          {
            item: order.item,
            quantity: order.quantity,
            price: order.price,
            site: order.site,
            warehouse: order.warehouse,
            zone: order.zone,
            location: order.location,
            aisle: order.aisle,
            rack: order.rack,
            shelf: order.shelf,
            bin: order.bin,
            config: order.config,
            color: order.color,
            size: order.size,
            style: order.style,
            version: order.version,
            batch: order.batch,
            serial: order.serial,
          },
        ];

    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx];
      const qty = order.orderType === "Return" ? -ln.quantity : ln.quantity;
      const price = ln.price;
      const dims = { /* same as above */ ...ln };

      // upsert real stock
      const sb = await StockBalanceModel.findOneAndUpdate(
        { item: ln.item, ...dims },
        {
          $inc: {
            quantity: qty,
            totalCostValue: qty * price,
            totalPurchaseValue: qty > 0 ? qty * price : 0,
            totalRevenueValue: qty < 0 ? -qty * price : 0,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      sb.extras = sb.extras || new Map();
      sb.extras.set("refType", "PurchaseOrder");
      sb.extras.set("refId", order._id.toString());
      sb.extras.set("refNum", order.orderNum);
      sb.extras.set("refLineNum", (idx + 1).toString());
      await sb.save({ session });

      // log transaction
      await InventoryTransactionModel.create(
        [
          {
            txnDate: new Date(),
            sourceType: "PURCHASE",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty,
            costPrice: sb.costPrice,
            purchasePrice: price,
            salesPrice: 0,
            transferPrice: 0,
            taxes: { gst: 0, withholdingTax: 0 },
            extras: {
              action:
                order.orderType === "Return"
                  ? "PURCHASE_RETURN"
                  : "PURCHASE_RECEIPT",
              refNum: order.orderNum,
            },
          },
        ],
        { session }
      );
    }
  }

  static async reversePO(order, session) {
    const lines = Array.isArray(order.lines)
      ? order.lines
      : [
          {
            item: order.item,
            quantity: order.quantity,
            price: order.price,
            site: order.site,
            warehouse: order.warehouse,
            zone: order.zone,
            location: order.location,
            aisle: order.aisle,
            rack: order.rack,
            shelf: order.shelf,
            bin: order.bin,
            config: order.config,
            color: order.color,
            size: order.size,
            style: order.style,
            version: order.version,
            batch: order.batch,
            serial: order.serial,
          },
        ];

    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx];
      const qty = order.orderType === "Return" ? -ln.quantity : ln.quantity;
      const price = ln.price;
      const dims = { /* same as above */ ...ln };

      // decrement real stock
      const sb = await StockBalanceModel.findOne({
        item: ln.item,
        ...dims,
      }).session(session);
      if (!sb) throw new Error("Stock record not found for reversal");
      sb.quantity -= qty;
      sb.totalCostValue -= qty * price;
      sb.totalPurchaseValue -= qty > 0 ? qty * price : 0;
      sb.totalRevenueValue -= qty < 0 ? -qty * price : 0;
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      await sb.save({ session });

      // log transaction
      await InventoryTransactionModel.create(
        [
          {
            txnDate: new Date(),
            sourceType: "PURCHASE",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty: -qty,
            costPrice: sb.costPrice,
            purchasePrice: price,
            salesPrice: 0,
            transferPrice: 0,
            taxes: { gst: 0, withholdingTax: 0 },
            extras: {
              action:
                order.orderType === "Return"
                  ? "PURCHASE_RETURN_REVERSAL"
                  : "PURCHASE_RECEIPT_REVERSAL",
              refNum: order.orderNum,
            },
          },
        ],
        { session }
      );
    }
  }
}

export default PurchaseStockService;
