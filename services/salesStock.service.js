// services/salesStock.service.js

import { InventoryTransactionModel } from "../models/inventoryTransaction.model.js";
import { StockBalanceModel } from "../models/inventStockBalance.model.js";
import { ProvisionalBalanceModel } from "../models/provisionalBalance.model.js";

class SalesStockService1 {
  static async reserveSO(so, session) {
    for (let i = 0; i < so.lines.length; i++) {
      const l = so.lines[i];
      const qty = so.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: so.site,
        warehouse: so.warehouse,
        // … copy any other dims you track on SO line …
        zone: so.zone,
        location: so.location,
        aisle: so.aisle,
        rack: so.rack,
        shelf: so.shelf,
        bin: so.bin,
        config: so.config,
        color: so.color,
        size: so.size,
        style: so.style,
        version: so.version,
        batch: so.batch,
        serial: so.serial,
      };

      const pb = await ProvisionalBalanceModel.findOneAndUpdate(
        key,
        { $inc: { quantity: qty, totalReserveValue: qty * l.price } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );

      // tag with reference
      pb.extras = pb.extras || new Map();
      pb.extras.set("refType", "SalesOrder");
      pb.extras.set("refId", so._id.toString());
      pb.extras.set("refNum", so.orderNum);
      pb.extras.set("refLineNum", i + 1);
      await pb.save({ session });
    }
  }

  static async releaseSO(so, session) {
    for (let i = 0; i < so.lines.length; i++) {
      const l = so.lines[i];
      const qty = so.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: so.site,
        warehouse: so.warehouse,
        zone: so.zone,
        location: so.location,
        aisle: so.aisle,
        rack: so.rack,
        shelf: so.shelf,
        bin: so.bin,
        config: so.config,
        color: so.color,
        size: so.size,
        style: so.style,
        version: so.version,
        batch: so.batch,
        serial: so.serial,
      };
      const pb = await ProvisionalBalanceModel.findOne(key).session(session);
      if (!pb) continue;
      pb.quantity -= qty;
      pb.totalReserveValue -= qty * l.price;
      await pb.save({ session });
    }
  }

  static async applySO(so, session) {
    for (let i = 0; i < so.lines.length; i++) {
      const l = so.lines[i];
      const qty = so.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: so.site,
        warehouse: so.warehouse,
        zone: so.zone,
        location: so.location,
        aisle: so.aisle,
        rack: so.rack,
        shelf: so.shelf,
        bin: so.bin,
        config: so.config,
        color: so.color,
        size: so.size,
        style: so.style,
        version: so.version,
        batch: so.batch,
        serial: so.serial,
      };
      const sb = await StockBalanceModel.findOneAndUpdate(
        key,
        {
          $inc: {
            quantity: qty,
            totalCostValue: qty * l.price,
            totalSalesValue: qty > 0 ? qty * l.price : 0,
            totalRevenueValue: qty < 0 ? -qty * l.price : 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
      // recompute moving‐average
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;

      // tag reference
      sb.extras = sb.extras || new Map();
      sb.extras.set("refType", "SalesOrder");
      sb.extras.set("refId", so._id.toString());
      sb.extras.set("refNum", so.orderNum);
      sb.extras.set("refLineNum", i + 1);
      await sb.save({ session });
    }
  }

  static async reverseSO(so, session) {
    for (let i = 0; i < so.lines.length; i++) {
      const l = so.lines[i];
      const qty = so.orderType === "Return" ? -l.quantity : l.quantity;
      const key = {
        item: l.item,
        site: so.site,
        warehouse: so.warehouse,
        zone: so.zone,
        location: so.location,
        aisle: so.aisle,
        rack: so.rack,
        shelf: so.shelf,
        bin: so.bin,
        config: so.config,
        color: so.color,
        size: so.size,
        style: so.style,
        version: so.version,
        batch: so.batch,
        serial: so.serial,
      };
      const sb = await StockBalanceModel.findOne(key).session(session);
      if (!sb) throw new Error("Stock record not found for reversal");
      sb.quantity -= qty;
      sb.totalCostValue -= qty * l.price;
      sb.totalSalesValue -= qty > 0 ? qty * l.price : 0;
      sb.totalRevenueValue -= qty < 0 ? -qty * l.price : 0;
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      await sb.save({ session });
    }
  }
}

// for single  item
class SalesStockService2 {
  static async reserveSO1(so, session) {
    const qty = so.orderType === "Return" ? -so.quantity : so.quantity;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      // … copy any other dims you track on SO line …
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };

    // const pb = await ProvisionalBalanceModel.findOneAndUpdate(
    //   key,
    //   { $inc: { quantity: qty, totalReserveValue: qty * so.price } },
    //   { upsert: true, new: true, setDefaultsOnInsert: true, session }
    // );

    // prepare the $inc object
    const update = {
      $inc: {
        quantity: qty,
        totalReserveValue: qty * so.price,
      },
      $set: {
        // stamp your SO reference fields into extras
        "extras.refType": "SalesOrder",
        "extras.refId": so._id.toString(),
        "extras.refNum": so.orderNum,
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
    // pb.extras.set("refType", "SalesOrder");
    // pb.extras.set("refId", so._id.toString());
    // pb.extras.set("refNum", so.orderNum);
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

  static async reserveSO(so, session) {
    const qty = so.orderType === "Return" ? -so.quantity : so.quantity;
    const value = qty * so.price;

    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };

    const update = {
      $inc: {
        quantity: qty,
        totalReserveValue: value,
      },
      // stamp your SO reference into the `extras` map
      $set: {
        "extras.refType": "SalesOrder",
        "extras.refId": so._id.toString(),
        "extras.refNum": so.orderNum,
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

  static async releaseSO(so, session) {
    const qty = so.orderType === "Return" ? -so.quantity : so.quantity;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };
    const pb = await ProvisionalBalanceModel.findOne(key).session(session);
    if (!pb) return;
    pb.quantity -= qty;
    pb.totalReserveValue -= qty * so.price;
    await pb.save({ session });
  }

  static async applySO(so, session) {
    const qty = so.orderType === "Return" ? -so.quantity : so.quantity;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };
    const sb = await StockBalanceModel.findOneAndUpdate(
      key,
      {
        $inc: {
          quantity: qty,
          totalCostValue: qty * so.price,
          totalSalesValue: qty > 0 ? qty * so.price : 0,
          totalRevenueValue: qty < 0 ? -qty * so.price : 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
    // recompute moving‐average
    sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;

    // tag reference
    sb.extras = sb.extras || new Map();
    sb.extras.set("refType", "SalesOrder");
    sb.extras.set("refId", so._id.toString());
    sb.extras.set("refNum", so.orderNum);
    sb.extras.set("refLineNum", 1);
    await sb.save({ session });
  }

  static async reverseSO(so, session) {
    const qty = so.orderType === "Return" ? -so.quantity : so.quantity;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };
    const sb = await StockBalanceModel.findOne(key).session(session);
    if (!sb) throw new Error("Stock record not found for reversal");
    sb.quantity -= qty;
    sb.totalCostValue -= qty * so.price;
    sb.totalSalesValue -= qty > 0 ? qty * so.price : 0;
    sb.totalRevenueValue -= qty < 0 ? -qty * so.price : 0;
    sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
    await sb.save({ session });
  }
}

class SalesStockService3 {
  /**
   * Reserve stock for a sales order (CONFIRMED status).
   *   - normal sale: qty → negative (outbound)
   *   - return   : qty → positive (inbound)
   */
  static async reserveSO(so, session) {
    const qtySigned = so.orderType === "Return" ? so.quantity : -so.quantity;
    const value = qtySigned * so.price;

    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };

    const update = {
      $inc: {
        quantity: qtySigned,
        totalReserveValue: value,
      },
      $set: {
        "extras.refType": "SALES",
        "extras.refId": so._id.toString(),
        "extras.refNum": so.orderNum,
      },
    };

    try {
      await ProvisionalBalanceModel.updateOne(key, update, {
        session,
        upsert: true,
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      // race → retry without upsert
      await ProvisionalBalanceModel.updateOne(key, update, { session });
    }
  }

  /**
   * Release stock (back to DRAFT/CANCELLED).
   */
  static async releaseSO(so, session) {
    const qtySigned = so.orderType === "Return" ? so.quantity : -so.quantity;
    const value = qtySigned * so.price;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };
    await ProvisionalBalanceModel.updateOne(
      key,
      { $inc: { quantity: -qtySigned, totalReserveValue: -value } },
      { session }
    );
  }

  /**
   * Apply real stock movement for a sale (Invoiced).
   */
  static async applySO(so, session) {
    const qtySigned = so.orderType === "Return" ? so.quantity : -so.quantity;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };

    // pick costPrice for reversal-of-issue
    const existing = await StockBalanceModel.findOne(key).session(session);
    const cost = existing?.costPrice || 0;

    const deltas = {
      quantity: qtySigned,
      totalCostValue: qtySigned * (qtySigned > 0 ? cost : cost),
      // for a sale, purchaseValue = 0; salesValue = (-qtySigned)*so.price
      totalRevenueValue:
        so.orderType === "Return"
          ? -so.quantity * cost
          : so.quantity * so.price,
      totalPurchaseValue: 0,
    };

    const sb = await StockBalanceModel.findOneAndUpdate(
      key,
      { $inc: deltas },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );
    sb.costPrice = sb.quantity > 0 ? sb.totalCostValue / sb.quantity : 0;

    // tag reference
    sb.extras = sb.extras || new Map();
    sb.extras.set("refType", "SALES");
    sb.extras.set("refId", so._id.toString());
    sb.extras.set("refNum", so.orderNum);
    await sb.save({ session });
  }

  /**
   * Reverse real stock (on Cancel after Invoiced).
   */
  static async reverseSO(so, session) {
    const qtySigned = so.orderType === "Return" ? so.quantity : -so.quantity;
    const key = {
      item: so.item,
      site: so.site,
      warehouse: so.warehouse,
      zone: so.zone,
      location: so.location,
      aisle: so.aisle,
      rack: so.rack,
      shelf: so.shelf,
      bin: so.bin,
      config: so.config,
      color: so.color,
      size: so.size,
      style: so.style,
      version: so.version,
      batch: so.batch,
      serial: so.serial,
    };

    const sb = await StockBalanceModel.findOne(key).session(session);
    if (!sb) throw new Error("Stock record not found for reversal");

    const cost = sb.costPrice || 0;
    sb.quantity -= qtySigned;
    sb.totalCostValue -= qtySigned * cost;
    sb.costPrice = sb.quantity > 0 ? sb.totalCostValue / sb.quantity : 0;
    await sb.save({ session });
  }
}

class SalesStockService {
  /**
   * Reserve inventory for a Purchase Order (Confirmed).
   * Loops through order.lines[] (or single root line if no array).
   */
  static async reserveSO(order, session) {
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
      const qty = order.orderType === "Return" ? ln.quantity : -ln.quantity;
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
            "extras.refType": "SaleOrder",
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
            sourceType: "SALES",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty,
            costPrice: 0,
            purchasePrice: 0,
            salesPrice: ln.price,
            transferPrice: 0,
            taxes: {
              gst: order.taxAmount,
              withholdingTax: order.withholdingTaxAmt,
            },
            extras: {
              action:
                order.orderType === "Return" ? "SALES_RETURN" : "SALES_ISSUE",
              actionType: "RESERVE",
              refNum: order.orderNum,
              discountAmt: order.discountAmt,
              chargesExpense: order.charges,
              chargedAmt: 20,
              gstPercent: order.tax,
            },
          },
        ],
        { session }
      );
    }
  }

  static async releaseSO(order, session) {
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
      const qty = order.orderType === "Return" ? ln.quantity : -ln.quantity;
      const val = qty * ln.price;
      // const dims = { /* same as above */ ...ln };
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
            sourceType: "SALES",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty: -qty,
            costPrice: 0,
            purchasePrice: 0,
            salesPrice: ln.price,
            transferPrice: 0,
            taxes: {
              gst: -order.taxAmount,
              withholdingTax: -order.withholdingTaxAmt,
            },
            extras: {
              action:
                order.orderType === "Return" ? "SALES_RETURN" : "SALES_ISSUE",
              actionType: "RELEASE",
              refNum: order.orderNum,
              discountAmt: -order.discountAmt,
              chargesExpense: -order.charges,
              chargedAmt: -20,
              gstPercent: order.tax,
            },
          },
        ],
        { session }
      );
    }
  }

  static async applySO(order, session) {
    const lines = Array.isArray(order.lines1)
      ? order.lines1
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

    const txns = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx];
      const qty = order.orderType === "Return" ? -ln.quantity : ln.quantity;
      const price = ln.price;
      const costPrice = ln.costPrice;
      const purchPrice = ln.purchPrice;
      // const dims = { /* same as above */ ...ln };
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

      // upsert real stock
      const sb = await StockBalanceModel.findOneAndUpdate(
        { item: ln.item, ...dims },
        {
          $inc: {
            quantity: qty,
            totalCostValue: qty * costPrice || 0,
            totalPurchaseValue: qty * purchPrice || 0,
            totalRevenueValue: qty * price,
            totalSalesValue: qty * price,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      sb.extras = sb.extras || new Map();
      sb.extras.set("refType", "SalesOrder");
      sb.extras.set("refId", order._id.toString());
      sb.extras.set("refNum", order.orderNum);
      sb.extras.set("refLineNum", (idx + 1).toString());
      await sb.save({ session });

      // log transaction
      // await InventoryTransactionModel.create(
      //   [
      //     {
      //       txnDate: new Date(),
      //       sourceType: "SALES",
      //       sourceId: order._id,
      //       sourceLine: idx + 1,
      //       item: ln.item,
      //       dims,
      //       qty,
      //       costPrice: sb.costPrice,
      //       purchasePrice: price,
      //       salesPrice: 0,
      //       transferPrice: 0,
      //       taxes: { gst: 0, withholdingTax: 0 },
      //       extras: {
      //         action:
      //           order.orderType === "Return" ? "SALES_RETURN" : "SALES_ISSUE",
      //         actionType: "APPLY",
      //         refNum: order.orderNum,
      //       },
      //     },
      //   ],
      //   { session }
      // );
      txns.push({
        txnDate: new Date(),
        sourceType: "SALES",
        sourceId: order._id,
        sourceLine: idx + 1,
        item: ln.item,
        dims,
        qty,
        costPrice: sb.costPrice,
        purchasePrice: purchPrice,
        salesPrice: price,
        transferPrice: 0,
        taxes: {
          gst: order.taxAmount,
          withholdingTax: order.withholdingTaxAmt,
        },
        extras: {
          action: order.orderType === "Return" ? "SALES_RETURN" : "SALES_ISSUE",
          actionType: "APPLY",
          refNum: order.orderNum,
          discountAmt: order.discountAmt,
          chargesExpense: order.charges,
          chargedAmt: 20,
          gstPercent: order.tax,
        },
      });
    }

    // once, at the end:
    // bulk‐insert and return the inserted docs
    const inserted = txns.length
      ? await InventoryTransactionModel.insertMany(txns, { session })
      : [];

    return inserted;
  }

  static async reverseSO(order, session) {
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
      const qty = order.orderType === "Return" ? ln.quantity : -ln.quantity;
      const price = ln.price;
      // const dims = { /* same as above */ ...ln };
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

      // decrement real stock
      const sb = await StockBalanceModel.findOne({
        item: ln.item,
        ...dims,
      }).session(session);
      if (!sb) throw new Error("Stock record not found for reversal");
      sb.quantity -= qty;
      sb.totalCostValue -= qty * price;
      sb.totalPurchaseValue -= qty < 0 ? -qty * price : 0;
      sb.totalRevenueValue -= qty < 0 ? -qty * price : 0;
      sb.totalSalesValue -= qty > 0 ? qty * price : 0;
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      await sb.save({ session });

      // log transaction
      await InventoryTransactionModel.create(
        [
          {
            txnDate: new Date(),
            sourceType: "SALES",
            sourceId: order._id,
            sourceLine: idx + 1,
            item: ln.item,
            dims,
            qty: -qty,
            costPrice: sb.costPrice,
            purchasePrice: 0,
            salesPrice: price,
            transferPrice: 0,
            taxes: {
              gst: order.taxAmount,
              withholdingTax: order.withholdingTaxAmt,
            },
            extras: {
              action:
                order.orderType === "Return"
                  ? "SALES_RETURN_REVERSAL"
                  : "SALES_ISSUE_REVERSAL",
              actionType: "REVERSE",
              refNum: order.orderNum,
              discountAmt: -order.discountAmt,
              chargesExpense: -order.charges,
              chargedAmt: -20,
              gstPercent: order.tax,
            },
          },
        ],
        { session }
      );
    }
  }
}

export default SalesStockService;
