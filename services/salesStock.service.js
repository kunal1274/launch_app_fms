// services/salesStock.service.js

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
class SalesStockService {
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

export default SalesStockService;
