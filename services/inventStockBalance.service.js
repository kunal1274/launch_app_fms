// services/stockBalance.service.js
// import { InventoryJournalModel } from "../models/inventoryJournal.model.js";
// import { StockBalanceModel } from "../models/stockBalance.model.js"; // you need to define this

import { StockBalanceModel } from '../models/inventStockBalance.model.js';

class StockBalanceService {
  /**
   * Apply a journal: increment/decrement on-hand & cost
   */
  static async applyJournal(journal, session) {
    for (const line of journal.lines) {
      const key = {
        item: line.item,
        site: line.from?.site || line.to?.site,
        warehouse: line.from?.warehouse || line.to?.warehouse,
        config: line.config,
        color: line.color,
        size: line.size,
        batch: line.batch,
        serial: line.serial,
      };
      // find or create stock record
      const sb = await StockBalanceModel.findOneAndUpdate(
        key,
        {
          $inc: {
            quantity: line.quantity,
            totalCostValue: line.quantity * line.costPrice,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      // update moving average cost
      sb.costPrice = sb.totalCostValue / sb.quantity;
      await sb.save({ session });
    }
  }

  /**
   * Reverse a posted journal
   */
  static async reverseJournal(journal, session) {
    for (const line of journal.lines) {
      const key = {
        item: line.item,
        site: line.from?.site || line.to?.site,
        warehouse: line.from?.warehouse || line.to?.warehouse,
        config: line.config,
        color: line.color,
        size: line.size,
        batch: line.batch,
        serial: line.serial,
      };
      const sb = await StockBalanceModel.findOne(key).session(session);
      if (!sb) throw new Error('Stock record not found for reversal.');
      sb.quantity -= line.quantity;
      sb.totalCostValue -= line.quantity * line.costPrice;
      sb.costPrice = sb.quantity ? sb.totalCostValue / sb.quantity : 0;
      await sb.save({ session });
    }
  }
}

export default StockBalanceService;
