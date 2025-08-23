import { SubledgerTransactionModel } from "../models/subledgerTxn.model.js";
import mongoose from "mongoose";

export default class SubledgerService {
  /**
   * Create one subledg­er txn.
   * @param {{type, sourceType, sourceId, sourceLine?, partyId?, itemId?, amount, currency, exchangeRate, dims?, extras?}} dto
   * @param {mongoose.ClientSession} session
   */
  static async createOld(dto, session = null) {
    const {
      subledgerType,
      postingEventType,
      sourceType,
      sourceId,
      sourceLine = 1,
      lineNum,
      ledgerAccount,
      customer,
      supplier,
      bankAccount,
      item,
      amount,
      currency,
      exchangeRate,
      dims = {},
      extras = {},
    } = dto;

    // compute localAmount:
    const local = Math.round(amount * exchangeRate * 100) / 100;

    const doc = new SubledgerTransactionModel({
      txnDate: dto.txnDate || new Date(),
      //subledgerType: type,

      subledgerType,
      postingEventType,
      sourceType,
      sourceId,
      sourceLine,
      ledgerAccount,
      customer,
      supplier,
      bankAccount,
      item,
      amount,
      currency,
      exchangeRate,
      localAmount: local,
      dims,
      extras,
    });

    return session ? doc.save({ session }) : doc.save();
  }

  // services/subledgerTxn.service.js

  static async create(dto, session = null) {
    let {
      subledgerType,
      postingEventType,
      previousPostingEventType = "NONE",
      nextPostingEventType = "NONE",
      sourceType,
      sourceId,
      sourceLine = 1,
      lineNum,
      ledgerAccount,
      customer,
      supplier,
      bankAccount,
      item,
      amount,
      currency,
      exchangeRate,
      dims = {},
      extras = {},
    } = dto;

    // if dto.extras is a Mongoose Map, convert to a plain object
    if (typeof extras.toObject === "function") {
      extras = extras.toObject();
    } else if (extras instanceof Map) {
      extras = Object.fromEntries(extras);
    }

    // 1) find the “prior” txn
    const prior = await SubledgerTransactionModel.findOne({
      subledgerType,
      sourceType,
      sourceId,
      postingEventType: previousPostingEventType,
    })
      .sort({ createdAt: -1 })
      .session(session);

    const local = Math.round(amount * exchangeRate * 100) / 100;

    // 2) build & save the new one

    const doc = new SubledgerTransactionModel({
      txnDate: dto.txnDate || new Date(),
      subledgerType,
      postingEventType,
      previousPostingEventType,
      nextPostingEventType,
      previousTxnId: prior?._id,
      // voucher‐link fields will be set later by VoucherService
      sourceType,
      sourceId,
      sourceLine,
      lineNum,
      ledgerAccount,
      customer,
      supplier,
      bankAccount,
      item,
      amount,
      currency,
      exchangeRate,
      localAmount: local,
      dims,
      extras,
    });

    await (session ? doc.save({ session }) : doc.save());

    //return session ? doc.save({ session }) : doc.save();

    // 3) patch the prior
    if (prior) {
      prior.nextTxnId = doc._id;
      prior.nextPostingEventType = postingEventType;
      await prior.save({ session });
    }

    return doc;
  }

  /**
   * List subledgers by filters.
   */
  static async list(filters = {}, { page = 1, limit = 50 } = {}) {
    const query = {};

    // map incoming filters:
    if (filters.type) query.subledgerType = filters.subledgerType;
    if (filters.sourceType) query.sourceType = filters.sourceType;
    if (filters.postingEventType)
      query.postingEventType = filters.postingEventType;
    if (filters.sourceId && mongoose.isValidObjectId(filters.sourceId))
      query.sourceId = filters.sourceId;
    ["ledgerAccount", "customer", "supplier", "bankAccount", "item"].forEach(
      (fld) => {
        if (filters[fld] && mongoose.isValidObjectId(filters[fld])) {
          query[fld] = filters[fld];
        }
      }
    );
    if (filters.startDate || filters.endDate) {
      query.txnDate = {};
      if (filters.startDate) query.txnDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.txnDate.$lte = new Date(filters.endDate);
    }

    const skip = (page - 1) * limit;
    const total = await SubledgerTransactionModel.countDocuments(query);
    const data = await SubledgerTransactionModel.find(query)
      .sort({ txnDate: -1, lineNum: 1 })
      .skip(skip)
      .limit(+limit)
      .lean();

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}
