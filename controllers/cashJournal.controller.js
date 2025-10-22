// controllers/cashJournal.controller.js

import mongoose from 'mongoose';
import { BankAccountModel } from '../models/bankAccount.model.js';
import { AccountModel } from '../models/account.model.js';
import { ARTransactionModel } from '../models/arTransaction.model.js';
import { APTransactionModel } from '../models/apTransaction.model.js';
import { GLJournalModel } from '../models/glJournal.model.js';
import VoucherService from '../services/voucher.service.js'; // or directly use GLJournalModel
import { CashFXRevalModel } from '../models/cashFXReval.model.js'; // if you want to store reval events (optional)

/**
 * Utility to round numbers to 2 decimal places.
 */
function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * 1) AR Receipt: Customer pays you -> Debit BankAccount, Credit Accounts Receivable.
 *
 *    Request Body:
 *    {
 *      "bankAccountId": "<ObjectId>",
 *      "customerId": "<ObjectId>",
 *      "amount": 1000.00,
 *      "currency": "USD",
 *      "exchangeRate": 75.00,
 *      "invoiceId": "<SalesInvoice ObjectId>",
 *      "remarks": "Receipt for INV_000123"
 *    }
 */
export const postARReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      bankAccountId,
      customerId,
      amount,
      currency,
      exchangeRate,
      invoiceId,
      remarks,
    } = req.body;

    // 1. Basic validation
    if (
      !bankAccountId ||
      !customerId ||
      !invoiceId ||
      !amount ||
      !currency ||
      !exchangeRate
    ) {
      throw new Error(
        'bankAccountId, customerId, invoiceId, amount, currency, exchangeRate are required.'
      );
    }
    if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
      throw new Error('Invalid bankAccountId.');
    }
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new Error('Invalid customerId.');
    }
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw new Error('Invalid invoiceId.');
    }

    // 2. Fetch BankAccount
    const bankAcc = await BankAccountModel.findById(bankAccountId).session(
      session
    );
    if (!bankAcc || !bankAcc.isActive) {
      throw new Error('BankAccount not found or inactive.');
    }
    if (bankAcc.currency !== currency) {
      throw new Error(
        `Currency mismatch: BankAccount currency is ${bankAcc.currency}, but received ${currency}.`
      );
    }

    // 3. Determine COA IDs
    //  - bankAcc.linkedCoaAccount (leaf COA for this bank account)
    //  - AR account (lookup by code "1.1.2" or some known code)
    const bankCoaId = bankAcc.linkedCoaAccount;
    const arAccount = await AccountModel.findOne({
      accountCode: '1.1.2', // replace with your actual AR leaf code
    }).session(session);
    if (!arAccount) {
      throw new Error('Accounts Receivable account not found in COA.');
    }
    const arCoaId = arAccount._id;

    // 4. Compute localAmount
    const localAmount = round2(amount * exchangeRate);

    // 5. Create AR subledger transaction
    const arTxn = await ARTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: 'SALES',
          sourceId: invoiceId,
          sourceLine: 1,
          customer: customerId,
          amount: round2(amount),
          currency: currency.trim(),
          exchangeRate: round2(exchangeRate),
          localAmount,
          bankAccount: bankAccountId,
          remarks: remarks || '',
        },
      ],
      { session }
    );
    const arTxnDoc = arTxn[0];

    // 6. Build GL Journal lines
    //    Line 1: Debit bank account (bankCoaId) by [amount/currency] → local = +localAmount
    //    Line 2: Credit AR (arCoaId) by [amount/currency] → local = -localAmount
    const voucherNo = await VoucherService.getNextVoucherNo();

    const glLines = [
      {
        account: bankCoaId,
        debit: round2(amount),
        credit: 0,
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        // localAmount = + (debit - credit) * exchangeRate
        localAmount: localAmount,
        subledger: {
          sourceType: 'AR',
          txnId: arTxnDoc._id,
          lineNum: 1,
        },
      },
      {
        account: arCoaId,
        debit: 0,
        credit: round2(amount),
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        // localAmount = (0 - credit) * exchangeRate = -localAmount
        localAmount: -localAmount,
        subledger: {
          sourceType: 'AR',
          txnId: arTxnDoc._id,
          lineNum: 1,
        },
      },
    ];

    // 7. Create GLJournal
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: new Date(),
      sourceType: 'AR_RECEIPT',
      sourceId: arTxnDoc._id,
      lines: glLines,
    });
    await glJournal.save({ session });

    // 8. Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: 'success',
      message: 'AR Receipt posted and GL Journal created.',
      data: { arTxn: arTxnDoc, glJournal },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ postARReceipt Error:', error);
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};

/**
 * 2) AP Payment: You pay a supplier -> Debit Accounts Payable, Credit BankAccount.
 *
 *    Request Body:
 *    {
 *      "bankAccountId": "<ObjectId>",
 *      "supplierId": "<ObjectId>",
 *      "amount": 500.00,
 *      "currency": "USD",
 *      "exchangeRate": 75.00,
 *      "purchaseInvoiceId": "<PurchaseInvoice ObjectId>",
 *      "remarks": "Payment for PCH_000456"
 *    }
 */
export const postAPPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      bankAccountId,
      supplierId,
      amount,
      currency,
      exchangeRate,
      purchaseInvoiceId,
      remarks,
    } = req.body;

    // 1. Basic validation
    if (
      !bankAccountId ||
      !supplierId ||
      !purchaseInvoiceId ||
      !amount ||
      !currency ||
      !exchangeRate
    ) {
      throw new Error(
        'bankAccountId, supplierId, purchaseInvoiceId, amount, currency, exchangeRate are required.'
      );
    }
    if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
      throw new Error('Invalid bankAccountId.');
    }
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new Error('Invalid supplierId.');
    }
    if (!mongoose.Types.ObjectId.isValid(purchaseInvoiceId)) {
      throw new Error('Invalid purchaseInvoiceId.');
    }

    // 2. Fetch BankAccount
    const bankAcc = await BankAccountModel.findById(bankAccountId).session(
      session
    );
    if (!bankAcc || !bankAcc.isActive) {
      throw new Error('BankAccount not found or inactive.');
    }
    if (bankAcc.currency !== currency) {
      throw new Error(
        `Currency mismatch: BankAccount currency is ${bankAcc.currency}, but received ${currency}.`
      );
    }

    // 3. Determine COA IDs
    //  - bankAcc.linkedCoaAccount
    //  - AP account (lookup by code "2.1.1" or whichever is your AP leaf code)
    const bankCoaId = bankAcc.linkedCoaAccount;
    const apAccount = await AccountModel.findOne({
      accountCode: '2.1.1', // replace with your actual AP leaf code
    }).session(session);
    if (!apAccount) {
      throw new Error('Accounts Payable account not found in COA.');
    }
    const apCoaId = apAccount._id;

    // 4. Compute localAmount
    const localAmount = round2(amount * exchangeRate);

    // 5. Create AP subledger transaction
    const apTxn = await APTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: 'PURCHASE',
          sourceId: purchaseInvoiceId,
          sourceLine: 1,
          supplier: supplierId,
          amount: round2(amount),
          currency: currency.trim(),
          exchangeRate: round2(exchangeRate),
          localAmount,
          bankAccount: bankAccountId,
          remarks: remarks || '',
        },
      ],
      { session }
    );
    const apTxnDoc = apTxn[0];

    // 6. Build GL Journal lines
    //    Line 1: Debit AP (apCoaId) by amount ↑ local = +localAmount
    //    Line 2: Credit bank account (bankCoaId) by amount ↑ local = -localAmount
    const voucherNo = await VoucherService.getNextVoucherNo();

    const glLines = [
      {
        account: apCoaId,
        debit: round2(amount),
        credit: 0,
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        localAmount: localAmount,
        subledger: {
          sourceType: 'AP',
          txnId: apTxnDoc._id,
          lineNum: 1,
        },
      },
      {
        account: bankCoaId,
        debit: 0,
        credit: round2(amount),
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        localAmount: -localAmount,
        subledger: {
          sourceType: 'AP',
          txnId: apTxnDoc._id,
          lineNum: 1,
        },
      },
    ];

    // 7. Create GLJournal
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: new Date(),
      sourceType: 'AP_PAYMENT',
      sourceId: apTxnDoc._id,
      lines: glLines,
    });
    await glJournal.save({ session });

    // 8. Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: 'success',
      message: 'AP Payment posted and GL Journal created.',
      data: { apTxn: apTxnDoc, glJournal },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ postAPPayment Error:', error);
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};

/**
 * 3) Bank‐to‐Bank Transfer: Move funds from one bank account to another.
 *
 *    Request Body:
 *    {
 *      "fromBankAccountId": "<ObjectId>",
 *      "toBankAccountId": "<ObjectId>",
 *      "amountFrom": 1000.00,
 *      "currencyFrom": "USD",
 *      "exchangeRateFrom": 75.00,
 *      "amountTo": 800.00,
 *      "currencyTo": "EUR",
 *      "exchangeRateTo": 85.00,
 *      "remarks": "USD→EUR transfer"
 *    }
 *
 *  If currencyFrom === currencyTo, we only need two lines (debit/credit).
 *  If different, we need a third “FX Gain/Loss” line to balance.
 */
export const postBankTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fromBankAccountId,
      toBankAccountId,
      amountFrom,
      currencyFrom,
      exchangeRateFrom,
      amountTo,
      currencyTo,
      exchangeRateTo,
      remarks,
    } = req.body;

    // 1. Basic validation
    if (
      !fromBankAccountId ||
      !toBankAccountId ||
      !amountFrom ||
      !currencyFrom ||
      !exchangeRateFrom ||
      !amountTo ||
      !currencyTo ||
      !exchangeRateTo
    ) {
      throw new Error(
        'fromBankAccountId, toBankAccountId, amountFrom, currencyFrom, exchangeRateFrom, amountTo, currencyTo, exchangeRateTo are required.'
      );
    }
    if (
      !mongoose.Types.ObjectId.isValid(fromBankAccountId) ||
      !mongoose.Types.ObjectId.isValid(toBankAccountId)
    ) {
      throw new Error('Invalid BankAccountId.');
    }
    if (fromBankAccountId === toBankAccountId) {
      throw new Error(
        'fromBankAccountId and toBankAccountId cannot be the same.'
      );
    }

    // 2. Fetch both BankAccount documents
    const fromBA = await BankAccountModel.findById(fromBankAccountId).session(
      session
    );
    if (!fromBA || !fromBA.isActive) {
      throw new Error('Source BankAccount not found or inactive.');
    }
    if (fromBA.currency !== currencyFrom) {
      throw new Error(
        `Source BankAccount currency mismatch: expected ${fromBA.currency}, got ${currencyFrom}`
      );
    }
    const toBA = await BankAccountModel.findById(toBankAccountId).session(
      session
    );
    if (!toBA || !toBA.isActive) {
      throw new Error('Destination BankAccount not found or inactive.');
    }
    if (toBA.currency !== currencyTo) {
      throw new Error(
        `Dest BankAccount currency mismatch: expected ${toBA.currency}, got ${currencyTo}`
      );
    }

    // 3. Determine COA IDs
    const fromCoaId = fromBA.linkedCoaAccount;
    const toCoaId = toBA.linkedCoaAccount;

    // 4. Compute local amounts
    const localFrom = round2(amountFrom * exchangeRateFrom);
    const localTo = round2(amountTo * exchangeRateTo);
    // FX difference in local currency
    const diffLocal = round2(localTo - localFrom);
    // If diffLocal > 0 → net local DEBIT bigger → we have an FX GAIN to record
    // If diffLocal < 0 → net local CREDIT bigger → we have an FX LOSS to record

    // 5. Build GL Journal lines
    const voucherNo = await VoucherService.getNextVoucherNo();
    const glLines = [];

    // a) Debit “to” account by amountTo in currencyTo
    glLines.push({
      account: toCoaId,
      debit: round2(amountTo),
      credit: 0,
      currency: currencyTo.trim(),
      exchangeRate: round2(exchangeRateTo),
      localAmount: localTo,
      subledger: {
        sourceType: 'BANK_TRANSFER',
        txnId: null, // we’ll fill after we create a “BankTransfer” doc if needed
        lineNum: 1,
      },
    });

    // b) Credit “from” account by amountFrom in currencyFrom
    glLines.push({
      account: fromCoaId,
      debit: 0,
      credit: round2(amountFrom),
      currency: currencyFrom.trim(),
      exchangeRate: round2(exchangeRateFrom),
      localAmount: -localFrom,
      subledger: {
        sourceType: 'BANK_TRANSFER',
        txnId: null,
        lineNum: 1,
      },
    });

    // c) If currencies differ, add FX Gain/Loss line to balance local
    if (diffLocal !== 0) {
      // Decide which COA account to use for FX gain/loss:
      //   if diffLocal > 0 → (localTo > localFrom) → local net DR > CR → that means we booked
      //     too little credit in local, so we have FX Gain (credit local) or FX Loss (debit local)?
      //   Actually: localTo (DR) − localFrom (CR) = diffLocal. If diffLocal > 0, then DR > CR, i.e. we need
      //     to **credit** an FX Gain account for diffLocal to make DR = CR.
      //   If diffLocal < 0, we need to **debit** an FX Loss account for |diffLocal|.
      //
      const fxAcct = await AccountModel.findOne({
        accountCode: diffLocal > 0 ? 'FX_GAIN' : 'FX_LOSS',
      }).session(session);
      if (!fxAcct) {
        throw new Error(
          `FX ${diffLocal > 0 ? 'Gain' : 'Loss'} account not found in COA.`
        );
      }

      if (diffLocal > 0) {
        // Credit FX Gain by diffLocal (in functional currency)
        glLines.push({
          account: fxAcct._id,
          debit: 0,
          credit: 0, // we store 0 in foreign currency fields (since no foreign currency here)
          currency: null, // you can keep null if this account is only functional
          exchangeRate: 1,
          localAmount: -diffLocal, // credit local
          subledger: {
            sourceType: 'BANK_TRANSFER',
            txnId: null,
            lineNum: 1,
          },
        });
      } else {
        // diffLocal < 0 → we need to debit FX Loss
        const lossAmt = Math.abs(diffLocal);
        glLines.push({
          account: fxAcct._id,
          debit: 0,
          credit: 0,
          currency: null,
          exchangeRate: 1,
          localAmount: lossAmt, // debit local
          subledger: {
            sourceType: 'BANK_TRANSFER',
            txnId: null,
            lineNum: 1,
          },
        });
      }
    }

    // 6. Create GLJournal (two or three lines)
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: new Date(),
      sourceType: 'BANK_TRANSFER',
      sourceId: new mongoose.Types.ObjectId(), // we can leave blank or generate a separate BankTransfer doc if needed
      lines: glLines,
      extras: { remarks: remarks || '' },
    });
    await glJournal.save({ session });

    // 7. Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: 'success',
      message: 'Bank transfer posted and GL Journal created.',
      data: glJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ postBankTransfer Error:', error);
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};

// controllers/cashJournal.controller.js (append at bottom)

/**
 * 4) FX Revaluation: Revalue a foreign‐currency bank account as of a given date.
 *
 *    Request Body:
 *    {
 *      "bankAccountId": "<ObjectId>",
 *      "asOfDate": "2025-06-30",
 *      "spotRate": 76.00,
 *      "remarks": "June‐end FX revaluation"
 *    }
 */
export const postFXRevaluation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bankAccountId, asOfDate, spotRate, remarks } = req.body;

    if (!bankAccountId || !asOfDate || !spotRate) {
      throw new Error('bankAccountId, asOfDate, and spotRate are required.');
    }
    if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
      throw new Error('Invalid bankAccountId.');
    }

    // 1) Fetch BankAccount
    const bankAcc = await BankAccountModel.findById(bankAccountId).session(
      session
    );
    if (!bankAcc || !bankAcc.isActive) {
      throw new Error('BankAccount not found or inactive.');
    }

    // It must be a non‐functional currency (i.e. currency != functional). For demonstration, assume INR is functional.
    const functionalCurrency = 'INR';
    if (bankAcc.currency === functionalCurrency) {
      throw new Error('Cannot revalue a bank account in functional currency.');
    }

    // 2) Compute net foreign currency balance and booked local balance as of asOfDate
    const cutoff = new Date(asOfDate + 'T23:59:59.999Z');

    // a) Aggregate GLJournal lines to get:
    //    1. netForeign = Σ(debit if currency==bankAcc.currency) − Σ(credit if currency==bankAcc.currency)
    //    2. bookedLocal = Σ(localAmount) for those lines (that local amount is already computed at historical rates).
    const agg = await GLJournalModel.aggregate([
      { $unwind: '$lines' },
      {
        $match: {
          'lines.account': bankAcc.linkedCoaAccount,
          voucherDate: { $lte: cutoff },
          'lines.currency': bankAcc.currency,
        },
      },
      {
        $group: {
          _id: null,
          netForeign: {
            $sum: {
              $subtract: ['$lines.debit', '$lines.credit'],
            },
          },
          bookedLocal: {
            $sum: '$lines.localAmount',
          },
        },
      },
    ]).session(session);

    const netForeign = agg.length ? agg[0].netForeign : 0; // e.g. 10000 (USD)
    const bookedLocal = agg.length ? agg[0].bookedLocal : 0; // e.g. 750000 (INR)

    // 3) Compute revalued local = netForeign × spotRate
    const revaluedLocal = round2(netForeign * spotRate);

    // 4) Compute difference
    const diffLocal = round2(revaluedLocal - bookedLocal);

    if (diffLocal === 0) {
      // No revaluation needed
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        status: 'success',
        message: 'No FX revaluation needed; already at spot.',
        data: { netForeign, bookedLocal, revaluedLocal, diffLocal },
      });
    }

    // 5) Build GL Journal lines
    const voucherNo = await VoucherService.getNextVoucherNo();
    const glLines = [];

    // a) If diffLocal > 0 → local is higher now → FX Gain. → Credit FX Gain, Debit Bank.
    // b) If diffLocal < 0 → local is lower → FX Loss. → Debit FX Loss, Credit Bank.

    // Fetch relevant FX Gain or FX Loss account
    const fxAcct = await AccountModel.findOne({
      accountCode: diffLocal > 0 ? 'FX_GAIN' : 'FX_LOSS',
    }).session(session);
    if (!fxAcct) {
      throw new Error(
        `FX ${diffLocal > 0 ? 'Gain' : 'Loss'} account not found in COA.`
      );
    }

    if (diffLocal > 0) {
      // Debit bank by diffLocal, Credit FX Gain by diffLocal
      glLines.push({
        account: bankAcc.linkedCoaAccount,
        debit: 0,
        credit: 0, // local currency only
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: diffLocal, // [DEBIT local = +diffLocal]
        subledger: {
          sourceType: 'FX_REVALUATION',
          txnId: null,
          lineNum: 1,
        },
      });
      glLines.push({
        account: fxAcct._id,
        debit: 0,
        credit: 0,
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: -diffLocal, // [CREDIT local = -diffLocal]
        subledger: {
          sourceType: 'FX_REVALUATION',
          txnId: null,
          lineNum: 1,
        },
      });
    } else {
      // diffLocal < 0 → local net is lower → FX Loss
      const lossAmt = Math.abs(diffLocal);
      glLines.push({
        account: fxAcct._id,
        debit: 0,
        credit: 0,
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: lossAmt, // [DEBIT local = +lossAmt]
        subledger: {
          sourceType: 'FX_REVALUATION',
          txnId: null,
          lineNum: 1,
        },
      });
      glLines.push({
        account: bankAcc.linkedCoaAccount,
        debit: 0,
        credit: 0,
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: -lossAmt, // [CREDIT local = -lossAmt]
        subledger: {
          sourceType: 'FX_REVALUATION',
          txnId: null,
          lineNum: 1,
        },
      });
    }

    // 6) Create GLJournal
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: cutoff,
      sourceType: 'FX_REVALUATION',
      sourceId: bankAccountId, // you can store the bankAccount as the source
      lines: glLines,
      extras: {
        spotRate: round2(spotRate),
        oldLocalBalance: round2(bookedLocal),
        newLocalBalance: round2(revaluedLocal),
        remarks: remarks || '',
      },
    });
    await glJournal.save({ session });

    // 7) Optionally, record this reval event to a separate collection (for audit)
    // const fxRevalRecord = await CashFXRevalModel.create(
    //   [
    //     {
    //       bankAccount: bankAccountId,
    //       asOfDate: cutoff,
    //       spotRate: round2(spotRate),
    //       netForeign,
    //       bookedLocal,
    //       revaluedLocal,
    //       diffLocal: round2(diffLocal),
    //       glJournal: glJournal._id,
    //       remarks: remarks || "",
    //     },
    //   ],
    //   { session }
    // );
    // const fxRevalDoc = fxRevalRecord[0];

    // 8) Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: 'success',
      message: 'FX Revaluation posted and GL Journal created.',
      data: {
        bankAccountId,
        netForeign,
        bookedLocal,
        revaluedLocal,
        diffLocal,
        glJournal,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ postFXRevaluation Error:', error);
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};
