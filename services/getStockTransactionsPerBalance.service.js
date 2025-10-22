import { InventoryJournalModel } from '../models/inventJournal.model.js';
import { StockBalanceModel } from '../models/inventStockBalance.model.js';
import { logStackError } from '../utility/logger.util.js';

export const getStockTransactionsPerBalance1 = async (req, res) => {
  try {
    // 1) Build a match‐function from query‐string dims:
    const dims = {};
    [
      'item',
      'site',
      'warehouse',
      'zone',
      'location',
      'aisle',
      'rack',
      'shelf',
      'bin',
      'config',
      'color',
      'size',
      'style',
      'version',
      'batch',
      'serial',
    ].forEach((key) => {
      if (req.query[key]) dims[key] = req.query[key];
    });

    // 2) Fetch all journals (posted + draft) that have at least one line matching dims
    //    We do a broad find, then filter in‐JS on the flattened lines.
    const journals = await InventoryJournalModel.find({
      'lines.item': dims.item || { $exists: true },
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
            'site',
            'warehouse',
            'zone',
            'location',
            'aisle',
            'rack',
            'shelf',
            'bin',
          ].includes(k)
            ? journal.type === 'TRANSFER'
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
        const posted = journal.status === 'POSTED';
        const draft = journal.status === 'DRAFT';
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

    return { data: ledger };
  } catch (err) {
    logStackError('❌ Stock Transactions Error', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Could not assemble transaction ledger.',
      error: err.message,
    });
  }
};

/**
 * Returns an array of ledger rows for the given req.query dims.
 * Each row has:
 *   { journalCode, lineNum, date,
 *     postedIn, postedOut, draftIn, draftOut,
 *     purchaseValue, salesValue, costValue,
 *     postedCumulative, draftCumulative, net,
 *     cumulativeCost, cumulativePurchase, cumulativeSales }
 */
export async function getStockTransactionsPerBalance(req) {
  try {
    // 1) Pull dims from the query
    const dims = {};
    [
      'item',
      'site',
      'warehouse',
      'zone',
      'location',
      'aisle',
      'rack',
      'shelf',
      'bin',
      'config',
      'color',
      'size',
      'style',
      'version',
      'batch',
      'serial',
    ].forEach((k) => {
      if (req.query[k]) dims[k] = req.query[k];
    });

    // 2) Find all journals that _might_ affect these dims.
    //    We match on lines.item, and will filter fully in‐JS.
    const journals = await InventoryJournalModel.find({
      'lines.item': dims.item,
    }).lean();

    // 3) Flatten & filter each line
    const txs = [];
    for (const journal of journals) {
      for (const line of journal.lines) {
        // check every dim
        let ok = true;
        for (const [k, v] of Object.entries(dims)) {
          let val;
          if (
            [
              'site',
              'warehouse',
              'zone',
              'location',
              'aisle',
              'rack',
              'shelf',
              'bin',
            ].includes(k)
          ) {
            // storage dims live under line.from or line.to
            val = (line.from?.[k] || line.to?.[k])?.toString();
          } else {
            // product/tracking dims live at top‐level of line
            val = line[k]?.toString();
          }
          if (val !== v) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        // 4) Build the transaction row
        const qty = line.quantity;
        const posted = journal.status === 'POSTED';
        const draft =
          journal.status === 'DRAFT' || journal.status === 'CONFIRMED';
        const inQty = qty > 0 ? qty : 0;
        const outQty = qty < 0 ? -qty : 0;
        const purchaseV = inQty * line.purchasePrice;
        const salesV = outQty * line.salesPrice;
        let costV = 0;

        if (posted) {
          // for issues we use existing costPrice
          const existing = await StockBalanceModel.findOne({
            item: line.item,
            site: line.from?.site || line.to?.site,
            warehouse: line.from?.warehouse || line.to?.warehouse,
            config: line.config,
            color: line.color,
            size: line.size,
            style: line.style,
            version: line.version,
            batch: line.batch,
            serial: line.serial,
          }).lean();
          const cp = existing?.costPrice || 0;

          costV = qty >= 0 ? purchaseV : -outQty * cp;
        }

        txs.push({
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
        });
      }
    }

    // 5) Sort chronologically
    txs.sort((a, b) => {
      const da = new Date(a.date),
        db = new Date(b.date);
      if (da < db) return -1;
      if (da > db) return 1;
      return a.journalCode.localeCompare(b.journalCode);
    });

    // 6) Compute running totals
    let runPostedIn = 0,
      runPostedOut = 0,
      runDraftIn = 0,
      runDraftOut = 0,
      runCost = 0,
      runPurchase = 0,
      runSales = 0;

    return txs.map((t) => {
      runPostedIn += t.postedIn;
      runPostedOut += t.postedOut;
      runDraftIn += t.draftIn;
      runDraftOut += t.draftOut;
      runPurchase += t.purchaseValue;
      runSales += t.salesValue;
      runCost += t.costValue;

      return {
        ...t,
        postedCumulative: runPostedIn - runPostedOut,
        draftCumulative: runDraftIn - runDraftOut,
        net: runPostedIn - runPostedOut + (runDraftIn - runDraftOut),
        cumulativePurchase: runPurchase,
        cumulativeSales: runSales,
        cumulativeCost: runCost,
      };
    });
  } catch (err) {
    logStackError('❌ getStockTransactionsPerBalance', err);
    throw err;
  }
}
