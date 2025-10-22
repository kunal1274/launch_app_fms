import { ProvisionalBalanceModel } from '../models/provisionalBalance.model.js';

export default class ProvisionalBalanceService {
  /**
   * Reserve all lines of a journal in the provisional balances
   */
  static async reserveJournal(journal, session) {
    for (const line of journal.lines) {
      const qty = line.quantity;
      const value = qty * (line.purchasePrice || line.costPrice);
      const key = {
        item: line.item,
        site: line.from?.site || line.to.site,
        warehouse: line.from?.warehouse || line.to.warehouse,
        // … copy over zone, location, aisle… bin, config, color, size, style, version, batch, serial …
        zone: line.from?.zone || line.to.zone,
        location: line.from?.location || line.to.locatio,
        aisle: line.from?.aisle || line.to.aisle,
        rack: line.from?.rack || line.to.rack,
        shelf: line.from?.shelf || line.to.shelf,
        bin: line.from?.bin || line.to.bin,
        /* … */
        config: line.config,
        color: line.color,
        size: line.size,
        style: line.style,
        version: line.version,
        batch: line.batch,
        serial: line.serial,
      };

      const update = {
        $inc: {
          quantity: qty,
          totalReserveValue: value,
        },
        $set: {
          'extras.refType': 'JOURNAL',
          'extras.refId': journal._id.toString(),
          'extras.refNum': journal.code,
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
  }

  /**
   * Release (un-reserve) all lines of a journal
   */
  static async releaseJournal(journal, session) {
    for (const line of journal.lines) {
      const qty = line.quantity;
      const value = qty * (line.purchasePrice || line.costPrice);
      const key = {
        item: line.item,
        site: line.from?.site || line.to.site,
        warehouse: line.from?.warehouse || line.to.warehouse,
        // … dims …
        zone: line.from?.zone || line.to.zone,
        location: line.from?.location || line.to.locatio,
        aisle: line.from?.aisle || line.to.aisle,
        rack: line.from?.rack || line.to.rack,
        shelf: line.from?.shelf || line.to.shelf,
        bin: line.from?.bin || line.to.bin,
        /* … */
        config: line.config,
        color: line.color,
        size: line.size,
        style: line.style,
        version: line.version,
        batch: line.batch,
        serial: line.serial,
      };

      await ProvisionalBalanceModel.findOneAndUpdate(
        key,
        { $inc: { quantity: -qty, totalReserveValue: -value } },
        { session }
      );
    }
  }
}
