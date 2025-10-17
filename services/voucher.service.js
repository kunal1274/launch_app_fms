// services/voucher.service.js

import { VoucherModel } from "../models/voucher.model.js";
import { FinancialVoucherCounterModel } from "../models/counter.model.js";
import { SubledgerTransactionModel } from "../models/subledgerTxn.model.js";

class VoucherService {
  static async getNextVoucherNo() {
    const ctr = await FinancialVoucherCounterModel.findByIdAndUpdate(
      { _id: "voucherCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    if (!ctr || ctr.seq === undefined) {
      throw new Error("❌ Failed to generate financial voucher number");
    }
    return `FVCHR_${ctr.seq.toString().padStart(6, "0")}`;
  }

  /**
   * Create a sales-order voucher, linking inventory, AR, tax, etc. txns
   */

  static async createSalesVoucher(
    { order, invTxns = [], arTxn, taxTxn, whtTxn, chargesTxn, discTxn },
    session
  ) {
    const voucherNo = await this.getNextVoucherNo();
    const currency = order.currency;
    const rate = order.exchangeRate || 1;
    const L = (amt) => Math.round(amt * rate * 100) / 100;

    const lines = [];

    //
    // 1) INVENTORY / COGS entries
    //
    for (const tx of invTxns) {
      const gross = tx.qty * tx.salesPrice; // e.g. 10×120 = 1,200
      const cogs = tx.qty * tx.costPrice; // e.g. 10×50  = 500
      lines.push({
        accountCode: "INVENTORY",
        debit: 0,
        credit: cogs,
        currency,
        exchangeRate: rate,
        localAmount: L(-cogs),
        dims: tx.dims,
        subledger: {
          sourceType: "INVENTORY",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });
      lines.push({
        accountCode: "COGS",
        debit: cogs,
        credit: 0,
        currency,
        exchangeRate: rate,
        localAmount: L(cogs),
        subledger: {
          sourceType: "INVENTORY",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });

      // net sales revenue _before_ tax/discount/charges
      const netRev =
        tx.qty * tx.salesPrice -
        (tx.extras.discountAmt || 0) +
        (tx.extras.chargedAmt || 0);
      lines.push({
        accountCode: "SALES_REVENUE",
        debit: 0,
        credit: netRev,
        currency,
        exchangeRate: rate,
        localAmount: L(-netRev),
        dims: tx.dims,
        subledger: {
          sourceType: "INVENTORY",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });

      // if you bill any line-level charges:
      if (tx.extras.chargedAmt) {
        lines.push({
          accountCode: "CHARGES_REVENUE",
          debit: 0,
          credit: tx.extras.chargedAmt,
          currency,
          exchangeRate: rate,
          localAmount: L(-tx.extras.chargedAmt),
          subledger: {
            sourceType: "INVENTORY",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }

      // if you allowed any line-level discount:
      if (tx.extras.discountAmt) {
        lines.push({
          accountCode: "DISCOUNT_ALLOWED",
          debit: tx.extras.discountAmt,
          credit: 0,
          currency,
          exchangeRate: rate,
          localAmount: L(tx.extras.discountAmt),
          subledger: {
            sourceType: "INVENTORY",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }

      // GST on that line:
      const gstBase = netRev;
      const gstAmt =
        Math.round(gstBase * (tx.extras.gstPercent || 0) * 100) / 100;
      if (gstAmt) {
        lines.push({
          accountCode: "GST_PAYABLE",
          debit: 0,
          credit: gstAmt,
          currency,
          exchangeRate: rate,
          localAmount: L(-gstAmt),
          subledger: {
            sourceType: "INVENTORY",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }
    }

    //
    // 2) ACCOUNTS RECEIVABLE
    //    * use the AR sub-ledger you already created in your controller
    //
    lines.push({
      accountCode: "ACCOUNTS_RECEIVABLE",
      debit: arTxn.amount,
      credit: 0,
      currency,
      exchangeRate: rate,
      localAmount: L(arTxn.amount),
      subledger: { sourceType: "AR", txnId: arTxn._id, lineNum: 1 },
    });

    //
    // 3) TAX at header level (if any)
    //
    if (taxTxn?.amount) {
      lines.push({
        accountCode: "TAX_PAYABLE",
        debit: 0,
        credit: taxTxn.amount,
        currency,
        exchangeRate: rate,
        localAmount: L(-taxTxn.amount),
        subledger: { sourceType: "TAX", txnId: taxTxn._id, lineNum: 1 },
      });
    }

    //
    // 4) WHT/TDS (header)
    //
    if (whtTxn?.amount) {
      // – debit TDS receivable
      lines.push({
        accountCode: "TDS_RECEIVABLE",
        debit: whtTxn.amount,
        credit: 0,
        currency,
        exchangeRate: rate,
        localAmount: L(whtTxn.amount),
        subledger: { sourceType: "WHT", txnId: whtTxn._id, lineNum: 1 },
      });
      // – credit AR
      lines.push({
        accountCode: "ACCOUNTS_RECEIVABLE",
        debit: 0,
        credit: whtTxn.amount,
        currency,
        exchangeRate: rate,
        localAmount: L(-whtTxn.amount),
        subledger: { sourceType: "WHT", txnId: whtTxn._id, lineNum: 1 },
      });
    }

    //
    // 5) Header‐level discount (if any)
    //
    if (discTxn?.amount) {
      lines.push({
        accountCode: "DISCOUNT_ALLOWED",
        debit: discTxn.amount,
        credit: 0,
        currency,
        exchangeRate: rate,
        localAmount: L(discTxn.amount),
        subledger: { sourceType: "DISCOUNT", txnId: discTxn._id, lineNum: 1 },
      });
      lines.push({
        accountCode: "ACCOUNTS_RECEIVABLE",
        debit: 0,
        credit: discTxn.amount,
        currency,
        exchangeRate: rate,
        localAmount: L(-discTxn.amount),
        subledger: { sourceType: "DISCOUNT", txnId: discTxn._id, lineNum: 1 },
      });
    }

    //
    // 6) Header‐level charges (if any)
    //
    if (chargesTxn?.amount) {
      lines.push({
        accountCode: "CHARGES_EXPENSE",
        debit: chargesTxn.amount,
        credit: 0,
        currency,
        exchangeRate: rate,
        localAmount: L(chargesTxn.amount),
        subledger: { sourceType: "CHARGES", txnId: chargesTxn._id, lineNum: 1 },
      });
      lines.push({
        accountCode: "ACCOUNTS_RECEIVABLE",
        debit: 0,
        credit: chargesTxn.amount,
        currency,
        exchangeRate: rate,
        localAmount: L(-chargesTxn.amount),
        subledger: { sourceType: "CHARGES", txnId: chargesTxn._id, lineNum: 1 },
      });
    }

    //
    // 7) FX gain/loss balancing (optional)
    //
    const totalLocal = lines.reduce(
      (sum, l) => sum + (l.debit - l.credit) * l.exchangeRate,
      0
    );
    if (Math.abs(totalLocal) > 0.01) {
      const isLoss = totalLocal > 0;
      lines.push({
        accountCode: isLoss ? "FX_LOSS" : "FX_GAIN",
        debit: isLoss ? Math.abs(totalLocal) : 0,
        credit: isLoss ? 0 : Math.abs(totalLocal),
        currency,
        exchangeRate: rate,
        localAmount: -Math.round(totalLocal * 100) / 100,
        subledger: { sourceType: "FX", txnId: order._id, lineNum: 1 },
        extras: { note: "Auto FX balancing" },
      });
    }

    //
    // 8) Save
    //
    const voucher = new VoucherModel({
      voucherNo,
      voucherDate: order.invoiceDate,
      sourceType: "SALES_INVOICE",
      sourceId: order._id,
      invoiceRef: {
        invoiceId: order._id,
        invoiceNum: order.invoiceNum,
      },
      lines,
    });
    await voucher.save({ session });
    return voucher;
  }

  /**
   * Build a voucher from an existing GL Journal.
   */

  // in VoucherService.createJournalVoucher:

  static async createJournalVoucher(
    glJournal,
    session,
    subTxnRefs = [],
    paramPostingEventType = "NONE"
  ) {
    const voucherNo = await this.getNextVoucherNo(session);

    // make a map: lineNum → subledgerTxnId
    const subMap = new Map(subTxnRefs.map((r) => [r.lineNum, r.id]));

    // 1) pull in the accountCode strings
    await glJournal.populate("lines.account");
    // let sblCode;
    const lines = glJournal.lines.map((l) => ({
      accountCode: l.account.accountCode, // <--- now filled
      // how to get conditional , // this can be customer or vendor or bank or ledger or item..
      subledgerCode: l.customer
        ? l.customer
        : l.vendor
        ? l.vendor
        : l.item
        ? l.item
        : l.bankAccount
        ? l.bankAccount
        : l.account, // this can be customer or vendor or bank or ledger or item..
      debit: l.debit,
      credit: l.credit,
      currency: l.currency,
      exchangeRate: l.exchangeRate,
      // localAmount will be handled by voucherSchema.pre("save")
      // subledger: {
      //   sourceType: "JOURNAL",
      //   txnId: glJournal._id,
      //   lineNum: l.lineNum,
      // },
      // now subledger.txnId points at the subledger transaction
      subledger: {
        sourceType: "JOURNAL",
        txnId: subMap.get(l.lineNum),
        lineNum: l.lineNum,
      },
      dims: l.dims,
      extras: l.extras,
    }));

    // 2) build & save, including invoiceRef
    const v = new VoucherModel({
      voucherNo,
      postingEventType: paramPostingEventType,
      voucherDate: glJournal.journalDate,
      sourceType: "JOURNAL",
      sourceId: glJournal._id,
      invoiceRef: {
        invoiceId: glJournal._id,
        invoiceNum: glJournal.globalJournalNum,
      },
      lines,
    });

    await v.save({ session });

    // 3a) back-stamp all the new sub-txns with this voucher
    const allSubIds = Array.from(subMap.values());
    await SubledgerTransactionModel.updateMany(
      { _id: { $in: allSubIds } },
      {
        $set: {
          relatedVoucher: v.voucherNo,
          currentVoucher: v.voucherNo,
        },
      },
      { session }
    );

    // 3b) **new**: for each of those sub-txns, if it has a previousTxnId, set that prior
    // sub-txn’s nextVoucher to this voucher
    for (let subId of allSubIds) {
      const sub = await SubledgerTransactionModel.findById(subId).session(
        session
      );
      if (sub?.previousTxnId) {
        await SubledgerTransactionModel.findByIdAndUpdate(
          sub.previousTxnId,
          { nextVoucher: v.voucherNo },
          { session }
        );
      }
    }

    // const voucherId = v._id;
    // await SubledgerTransactionModel.updateMany(
    //   { _id: { $in: Array.from(subMap.values()) } },
    //   { $set: { relatedVoucher: voucherId } },
    //   { session }
    // );
    return v;
  }
}

export default VoucherService;

/*
  static async createSalesVoucher1(
    { order, invTxns, arTxn, taxTxn, whtTxn, chargesTxn },
    session
  ) {
    const voucherNo = await this.getNextVoucherNo();
    const currency = order.currency;
    const rate = order.exchangeRate || 1;
    const L = (amt) => Math.round(amt * rate * 100) / 100;
    const lines = [];

    // AR debit
    lines.push({
      accountCode: "ACCOUNTS_RECEIVABLE",
      debit: order.netAR,
      credit: 0,
      subledger: { sourceType: "AR", txnId: arTxn._id, lineNum: 1 },
    });

    // Inventory credit
    for (let i = 0; i < invTxns.length; i++) {
      const tx = invTxns[i];
      const salesRev = tx.qty * tx.salesPrice;
      lines.push({
        accountCode: "SALES_REVENUE",
        debit: 0,
        credit: salesRev,
        dims: tx.dims,
        subledger: {
          sourceType: "INVENTORY",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });
    }

    // Tax liability
    if (taxTxn) {
      lines.push({
        accountCode: "TAX_PAYABLE",
        debit: 0,
        credit: taxTxn.amount,
        subledger: { sourceType: "TAX", txnId: taxTxn._id, lineNum: 1 },
      });
    }

    // WHT
    if (whtTxn) {
      lines.push({
        accountCode: "WHT_PAYABLE",
        debit: taxTxn.amount ? 0 : 0,
        credit: whtTxn.amount,
        subledger: { sourceType: "WHT", txnId: whtTxn._id, lineNum: 1 },
      });
    }

    // Charges
    if (chargesTxn) {
      lines.push({
        accountCode: "CHARGES_EXPENSE",
        debit: chargesTxn.amount,
        credit: 0,
        subledger: { sourceType: "CHARGES", txnId: chargesTxn._id, lineNum: 1 },
      });
    }

    const voucher = new VoucherModel({
      voucherNo,
      voucherDate: order.invoiceDate,
      sourceType: "SALES_ORDER",
      sourceId: order._id,
      lines,
    });

    await voucher.save({ session });
    return voucher;
  }

  static async createSalesVoucher2(
    { order, invTxns, arTxn, taxTxn, whtTxn, chargesTxn, discTxn },
    session
  ) {
    const voucherNo = await this.getNextVoucherNo();
    const currency = order.currency;
    const rate = order.exchangeRate || 1;
    //const hdrDisc = order.extras.discountAmt || 0;
    //const hdrCharges = order.extras.charges || 0;
    //const hdrChargedAmt = order.extras.chargedAmount || 0;
    // const hdrTaxableBase =
    const L = (amt) => Math.round(amt * rate * 100) / 100;

    const lines = [];

    // ——————————————
    // 1) INVENTORY & COGS
    // ——————————————
    let netAR = 340;
    for (const tx of invTxns) {
      const gross = tx.qty * tx.salesPrice; // 10 * 120 = Dr 1200 AR against Cr 1200 Sales Revenue ( Item )
      const cogs = tx.qty * tx.costPrice; // 10 * 50 = Dr 500 COGS against Cr 500 Inventory Issue
      const disc = tx.extras.discountAmt || 0; // Dr 90 against Cr AR
      const chargesExpense = tx.extras.chargesExpense || 0; // Dr 100  against Cr AR
      const chargedIncome = tx.extras.chargedAmt || 0; // Cr 200 against Dr AR

      //const gstOnChargedIncome = tx.extras.gstAmtOnChargedIncome || 0;
      //const netRev = gross - disc + chargedIncome;
      //const netRevOnCharges = chargedIncome;

      //const costTotal = tx.qty * tx.costPrice;
      const taxableBase = gross - disc - chargesExpense + chargedIncome; // 1200 - 90 - 100 + 200 = 1210 = Taxable Base
      const gstAmt = Math.round(taxableBase * tx.extras.gstPercent * 100) / 100; // 10% = 121.00 ( 10% of Taxable Base )
      const netLineAR = taxableBase + gstAmt;
      netAR += netLineAR;
      // a) credit Inventory asset
      lines.push({
        accountCode: "INVENTORY",
        debit: 0,
        credit: cogs,
        currency,
        exchangeRate: rate,
        //localAmount: L(-cogs),
        dims: tx.dims,
        subledger: {
          sourceType: "INVENTORY",
          //transDir: "OUT",
          //transType: "ASSET",
          //componentType: "ITEM",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });

      // b) debit COGS
      lines.push({
        accountCode: "COGS",
        debit: cogs,
        credit: 0,
        currency,
        exchangeRate: rate,
        //localAmount: L(cogs),
        subledger: {
          sourceType: "INVENTORY",
          // transDir: "IN",
          // transType: "EXPENSE",
          // componentType: "ITEM",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });

      // 2) Sales revenue net of discount
      lines.push({
        accountCode: "SALES_REVENUE",
        debit: 0,
        credit: taxableBase,
        currency,
        exchangeRate: rate,
        //localAmount: L(-taxableBase),
        dims: tx.dims,
        subledger: {
          sourceType: "INVENTORY",
          // transDir: "OUT",
          // transType: "REVENUE",
          // componentType: "ITEM",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });

      // // 2) Sales revenue net of discount
      if (chargedIncome != 0) {
        lines.push({
          accountCode: "CHARGES_REVENUE",
          debit: 0,
          credit: chargedIncome,
          currency,
          exchangeRate: rate,
          // localAmount: L(-chargedIncome),
          dims: tx.dims,
          subledger: {
            sourceType: "INVENTORY",
            // transDir: "OUT",
            // transType: "REVENUE",
            // componentType: "CHARGES",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }

      if (gstAmt !== 0) {
        lines.push({
          accountCode: "GST_PAYABLE",
          debit: gstAmt < 0 ? gstAmt : 0,
          credit: gstAmt > 0 ? gstAmt : 0,
          currency,
          exchangeRate: rate,
          // localAmount: L(-gstAmt), // here alos signed related changes are required.
          subledger: {
            sourceType: "INVENTORY",
            // transDir: "OUT",
            // transType: "TAX",
            // componentType: "GST_ITEM",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }

      // if (gstOnChargedIncome !== 0) {
      //   lines.push({
      //     accountCode: "GST_PAYABLE",
      //     debit: 0,
      //     credit: gstOnChargedIncome,
      //     currency,
      //     exchangeRate: rate,
      //     localAmount: L(-gstOnChargedIncome),
      //     subledger: {
      //       sourceType: "INVENTORY",
      //       transDir: "OUT",
      //       transType: "TAX",
      //       componentType: "GST_CHARGES",
      //       txnId: taxTxn._id,
      //       lineNum: tx.sourceLine,
      //     },
      //   });
      // }

      // 3) Discount Allowed expense
      if (disc !== 0) {
        lines.push({
          accountCode: "DISCOUNT_ALLOWED",
          debit: disc > 0 ? disc : 0,
          credit: disc < 0 ? disc : 0,
          currency,
          exchangeRate: rate,
          // localAmount: L(disc),
          subledger: {
            sourceType: "INVENTORY",
            // transDir: "OUT",
            // transType: "TAX",
            // componentType: "GST_CHARGES",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }

      // 3) charges as an expense Allowed expense
      if (chargesExpense !== 0) {
        lines.push({
          accountCode: "CHARGES_EXPENSE",
          debit: chargesExpense,
          credit: 0,
          currency,
          exchangeRate: rate,
          //localAmount: L(chargesExpense),
          subledger: {
            sourceType: "INVENTORY",
            // transDir: "OUT",
            // transType: "EXPENSE",
            // componentType: "CHARGES",
            txnId: tx._id,
            lineNum: tx.sourceLine,
          },
        });
      }

      lines.push({
        accountCode: "ACCOUNTS_RECEIVABLE_LINE",
        debit: netLineAR > 0 ? netLineAR : 0,
        credit: netLineAR < 0 ? netLineAR : 0,
        currency,
        exchangeRate: rate,
        //localAmount: L(netLineAR),
        subledger: {
          sourceType: "LINE_AR",
          txnId: tx._id,
          lineNum: tx.sourceLine,
        },
      });
    }

    // if (hdrDisc !== 0) {
    //   lines.push({
    //     accountCode: "DISCOUNT_ALLOWED",
    //     debit: hdrDisc,
    //     credit: 0,
    //     currency,
    //     exchangeRate: rate,
    //     localAmount: L(hdrDisc),
    //     subledger: { sourceType: "AR", txnId: arTxn._id, lineNum: 1 },
    //     extras: { note: "Header discount" },
    //   });
    // }

    // ——————————————
    // 2) SALES REVENUE
    // ——————————————
    // net sales before tax/WHT/charges
    // const netSales =
    //   order.netAR - (order.taxAmount + order.withholdingTaxAmt + order.charges);
    // lines.push({
    //   accountCode: "SALES_REVENUE",
    //   debit: 0,
    //   credit: netSales,
    //   currency,
    //   exchangeRate: rate,
    //   localAmount: L(-netSales),
    //   subledger: { sourceType: "AR", txnId: arTxn._id, lineNum: 1 },
    // });

    // ——————————————
    // 3) ACCOUNTS RECEIVABLE
    // ——————————————
    lines.push({
      accountCode: "TDS_RECEIVABLE",
      debit: order.withholdingTaxAmt > 0 ? order.withholdingTaxAmt : 0,
      credit: order.withholdingTaxAmt < 0 ? order.withholdingTaxAmt : 0,
      currency,
      exchangeRate: rate,
      //localAmount: L(order.withholdingTaxAmt),
      subledger: { sourceType: "WHT", txnId: arTxn._id, lineNum: 1 },
    });
    lines.push({
      accountCode: "ACCOUNTS_RECEIVABLE_WHT",
      debit: order.withholdingTaxAmt < 0 ? order.withholdingTaxAmt : 0,
      credit: order.withholdingTaxAmt > 0 ? order.withholdingTaxAmt : 0,
      currency,
      exchangeRate: rate,
      //localAmount: L(order.withholdingTaxAmt),
      subledger: { sourceType: "WHT", txnId: arTxn._id, lineNum: 1 },
    });

    lines.push({
      accountCode: "ACCOUNTS_RECEIVABLE",
      debit: netAR > 0 ? netAR - order.withholdingTaxAmt : 0,
      credit: netAR < 0 ? netAR - order.withholdingTaxAmt : 0,
      currency,
      exchangeRate: rate,
      //localAmount: L(netAR),
      subledger: { sourceType: "AR", txnId: arTxn._id, lineNum: 2 },
    });

    // ——————————————
    // // 4) GST
    // // ——————————————
    // if (taxTxn && taxTxn.amount > 0) {
    //   lines.push({
    //     accountCode: "GST_PAYABLE",
    //     debit: 0,
    //     credit: taxTxn.amount,
    //     currency,
    //     exchangeRate: rate,
    //     localAmount: L(-taxTxn.amount),
    //     subledger: { sourceType: "TAX", txnId: taxTxn._id, lineNum: 1 },
    //   });
    // }

    // ——————————————
    // 5) TDS (WHT)
    // ——————————————
    // if (whtTxn && whtTxn.amount > 0) {
    //   // debit TDS receivable
    //   lines.push({
    //     accountCode: "TDS_RECEIVABLE",
    //     debit: whtTxn.amount,
    //     credit: 0,
    //     currency,
    //     exchangeRate: rate,
    //     localAmount: L(whtTxn.amount),
    //     subledger: { sourceType: "WHT", txnId: whtTxn._id, lineNum: 1 },
    //   });
    //   // credit AR to net it off
    //   lines.push({
    //     accountCode: "ACCOUNTS_RECEIVABLE",
    //     debit: 0,
    //     credit: whtTxn.amount,
    //     currency,
    //     exchangeRate: rate,
    //     localAmount: L(-whtTxn.amount),
    //     subledger: { sourceType: "WHT", txnId: whtTxn._id, lineNum: 1 },
    //   });
    // }

    // ——————————————
    // 6) FREIGHT / CHARGES
    // ——————————————
    // if (chargesTxn && chargesTxn.amount > 0) {
    //   // freight expense
    //   lines.push({
    //     accountCode: "FREIGHT_EXPENSE",
    //     debit: chargesTxn.amount,
    //     credit: 0,
    //     currency,
    //     exchangeRate: rate,
    //     localAmount: L(chargesTxn.amount),
    //     subledger: {
    //       sourceType: "CHARGES_EXPENSE",
    //       txnId: chargesTxn._id,
    //       lineNum: 1,
    //     },
    //   });
    //   // if you also bill freight separately:
    //   if (chargesTxn.chargedAmount) {
    //     lines.push({
    //       accountCode: "FREIGHT_INCOME",
    //       debit: 0,
    //       credit: chargesTxn.chargedAmount,
    //       currency,
    //       exchangeRate: rate,
    //       localAmount: L(-chargesTxn.chargedAmount),
    //       subledger: {
    //         sourceType: "CHARGES_INCOME",
    //         txnId: chargesTxn._id,
    //         lineNum: 1,
    //       },
    //     });

    //     // credit AR to net it off
    //     lines.push({
    //       accountCode: "ACCOUNTS_RECEIVABLE",
    //       debit: chargesTxn.chargedAmount,
    //       credit: 0,
    //       currency,
    //       exchangeRate: rate,
    //       localAmount: L(-chargesTxn.chargedAmount),
    //       subledger: {
    //         sourceType: "CHARGES_INCOME",
    //         txnId: chargesTxn._id,
    //         lineNum: 1,
    //       },
    //     });
    //   }
    // }

    // ——————————————
    // 7) FX Gain/Loss balancing
    // ——————————————
    // const sumLocal = lines.reduce(
    //   (acc, l) => acc + (l.debit - l.credit) * l.exchangeRate,
    //   0
    // );
    // if (Math.abs(sumLocal) > 0.01) {
    //   const acct = sumLocal > 0 ? "FX_LOSS" : "FX_GAIN";
    //   const amt = Math.abs(sumLocal);
    //   lines.push({
    //     accountCode: acct,
    //     debit: acct === "FX_LOSS" ? amt : 0,
    //     credit: acct === "FX_GAIN" ? amt : 0,
    //     currency,
    //     exchangeRate: rate,
    //     localAmount: (Math.round(sumLocal * 100) / 100) * -1,
    //     subledger: { sourceType: "JOURNAL", txnId: order._id, lineNum: 1 },
    //     extras: { note: "Auto FX balancing" },
    //   });
    // }

    // ——————————————
    // 8) SAVE VOUCHER
    // ——————————————
    const voucher = new VoucherModel({
      voucherNo,
      voucherDate: order.invoiceDate,
      sourceType: "SALES_ORDER",
      sourceId: order._id,
      // ── NEW:
      invoiceRef: {
        invoiceId: order._id,
        invoiceNum: order.invoiceNum,
      },
      lines,
    });
    await voucher.save({ session });
    return voucher;
  }
*/

// static async createJournalVoucher(glJournal, session) {
//     const voucherNo = await this.getNextVoucherNo(session);
//     const lines = glJournal.lines.map((l) => ({
//       accountCode: l.accountCode || l.extras.accountCode, // or lookup
//       debit: l.debit,
//       credit: l.credit,
//       currency: l.currency,
//       exchangeRate: l.exchangeRate,
//       // localAmount will be set by pre-save
//       subledger: {
//         sourceType: "JOURNAL",
//         txnId: glJournal._id,
//         lineNum: l.lineNum,
//       },
//       dims: l.dims,
//       extras: l.extras,
//     }));

//     const v = new VoucherModel({
//       voucherNo,
//       voucherDate: glJournal.journalDate,
//       sourceType: "JOURNAL",
//       sourceId: glJournal._id,
//       lines,
//     });
//     return v.save({ session });
//   }
