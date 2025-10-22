// controllers/account.controller.js

import mongoose from 'mongoose';
// import redisClient from "../middleware/redisClient.js";

import { BB0_AccountModel } from '../models/bb0.account.model.js';
import { BB0_GlobalPartyModel } from '../../gm_svc/models/bb0.globalParty.model.js';
import { BB0_LedgerAccountCounterModel } from '../../shm_svc/models/bb0.counter.model.js';
import { BB0_AccountTemplateModel } from '../models/bb0.accountTemplate.model.js';

/**
 * Utility: validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// // Helper: invalidate aisle cache
// const invalidateAccountCache = async (key = "/fms/api/v0/accounts") => {
//   try {
//     await redisClient.del(key);
//     logger.info(`Cache invalidated: ${key}`, {
//       context: "invalidateAccountCache",
//     });
//   } catch (err) {
//     logStackError("❌ Account cache invalidation failed", err);
//   }
// };

/**
 * 1) GET ALL ACCOUNTS
 *    - Optional query param: ?includeArchived=true  (defaults to false)
 *    - Optional query param: ?hierarchy=true       (if you want nested tree)
 */
export const getAllAccounts = async (req, res) => {
  try {
    const { includeArchived, hierarchy } = req.query;
    const filter = {};

    if (includeArchived !== 'true') {
      // Only fetch non-archived by default
      filter.isArchived = false;
    }

    // 1) Fetch all matching accounts
    const accounts = await BB0_AccountModel.find(filter)
      .sort({ accountCode: 1 })
      .lean();

    // 2) If user wants a hierarchical tree, build it
    if (hierarchy === 'true') {
      // Build a map of id → node
      const nodeMap = {};
      accounts.forEach((acct) => {
        nodeMap[acct._id.toString()] = {
          _id: acct._id,
          accountCode: acct.accountCode,
          accountName: acct.accountName,
          accType: acct.accType,
          normalBalance: acct.normalBalance,
          isLeaf: acct.isLeaf,
          allowManualPost: acct.allowManualPost,
          currency: acct.currency,
          description: acct.description,
          group: acct.group,
          isArchived: acct.isArchived,
          parentAccount: acct.parentAccount,
          children: [],
        };
      });

      // Now connect children → parent
      const roots = [];
      accounts.forEach((acct) => {
        if (acct.parentAccount) {
          const parentId = acct.parentAccount.toString();
          if (nodeMap[parentId]) {
            nodeMap[parentId].children.push(nodeMap[acct._id.toString()]);
          }
        } else {
          // no parent → top‐level
          roots.push(nodeMap[acct._id.toString()]);
        }
      });

      return res.status(200).json({ status: 'success', data: roots });
    }

    // 3) Otherwise return flat list
    return res.status(200).json({ status: 'success', data: accounts });
  } catch (error) {
    console.error('❌ getAllAccounts Error:', error);
    return res
      .status(500)
      .json({ status: 'failure', message: 'Internal server error.' });
  }
};

/**
 * 2) GET ONE ACCOUNT BY ID
 */
export const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id, '105');
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: 'failure', message: 'Invalid ID' });
    }
    const acct = await BB0_AccountModel.findById(id).lean();
    if (!acct) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Account not found.' });
    }
    return res.status(200).json({ status: 'success', data: acct });
  } catch (error) {
    // console.error("❌ getAccountById Error:", error);
    return res
      .status(500)
      .json({ status: 'failure', message: 'Internal server error.' });
  }
};

/**
 * 3) CREATE ONE ACCOUNT
 */
export const createAccount = async (req, res) => {
  try {
    // console.log("127", req.body);
    const {
      accountCode,
      globalPartyId,
      accountName,
      accType,
      parentAccount,
      normalBalance,
      isLeaf,
      allowManualPost,
      currency,
      description,
      group,
    } = req.body;

    // Basic validation
    if (!accountCode || !accountName || !accType || !normalBalance) {
      return res.status(400).json({
        status: 'failure',
        message:
          'accountCode, accountName, accType, and normalBalance are required.',
      });
    }

    // Only validate parentAccount if provided
    if (parentAccount) {
      const parentAcct = await BB0_AccountModel.findById(parentAccount).lean();
      if (!parentAcct) {
        return res
          .status(404)
          .json({ status: 'failure', message: 'Parent Account not found.' });
      }
      if (parentAcct.isLeaf) {
        return res.status(422).json({
          status: 'failure',
          message: 'Parent Account cannot be a leaf.',
        });
      }
    }

    // 2) Prepare a variable to hold the final partyId
    let partyId = null;

    // 3) If no globalPartyId was passed, we create a new GlobalParty doc with partyType=["Customer"].
    if (!globalPartyId) {
      const newParty = await BB0_GlobalPartyModel.create({
        name: accountCode, // or pass something else for .name
        partyType: ['Account'], // force the array to have "Customer"
      });
      partyId = newParty._id;
    } else {
      // 4) If globalPartyId is provided, we find that doc
      const existingParty = await BB0_GlobalPartyModel.findById(globalPartyId);
      if (!existingParty) {
        // Option A: Throw an error
        // return res.status(404).send({
        //   status: "failure",
        //   message: `GlobalParty with ID ${globalPartyId} does not exist.`,
        // });

        // Option B: Or create a new GlobalParty doc with that _id (rarely recommended)
        // But usually you'd want to fail if the globalPartyId doesn't exist
        return res.status(404).json({
          status: 'failure',
          message: `⚠️ GlobalParty ${globalPartyId} not found. (Cannot create Account referencing missing party.)`,
        });
      }

      // 5) If found, ensure "Customer" is in the partyType array
      if (!existingParty.partyType.includes('Account')) {
        existingParty.partyType.push('Account');
        await existingParty.save();
      }

      // We'll use the existingParty's _id
      partyId = existingParty._id;
    }

    // console.log("account code", accountCode);
    const newAcct = new BB0_AccountModel({
      globalPartyId: partyId,
      accountCode: accountCode.trim(),
      accountName: accountName.trim(),
      accType,
      parentAccount: parentAccount || null,
      normalBalance,
      isLeaf: isLeaf === false ? false : true, // default true
      allowManualPost: allowManualPost === false ? false : true,
      currency: currency ? currency.trim() : 'INR',
      description: description || '',
      group: group || '',
    });

    // console.log("new Acct ", newAcct);

    await newAcct.save();
    return res
      .status(201)
      .json({ status: 'success', message: 'Account created.', data: newAcct });
  } catch (error) {
    //console.error("❌ createAccount Error:", error);
    try {
      // const isCounterIncremented =
      //   error.message &&
      //   !error.message.startsWith("❌ Duplicate contact number");
      //if (isCounterIncremented) {
      await BB0_LedgerAccountCounterModel.findByIdAndUpdate(
        { _id: 'bb0_glAccCode' },
        { $inc: { seq: -1 } }
      );
      // }
    } catch (decrementError) {
      console.error('❌ Error during counter decrement:', decrementError.stack);
    }
    if (error.name === 'ValidationError') {
      return res
        .status(422)
        .json({ status: 'failure', message: error.message });
    }
    // show exactly which key is duplicated
    if (error.code === 11000) {
      // console.error("❌ Duplicate key details:", error.keyValue);
      return res.status(409).json({
        status: 'failure',
        message: `Duplicate ${Object.keys(error.keyValue)[0]}: ${
          Object.values(error.keyValue)[0]
        } already exists.`,
      });
    }

    return res
      .status(500)
      .json({ status: 'failure', message: 'Internal server error.' });
  }
};

/**
 * 4) BULK CREATE ACCOUNTS
 *    Expect: { data: [ { accountCode, accountName, accType, … }, … ] }
 */
export const bulkCreateAccounts = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'Request body must contain a non-empty `data` array.',
      });
    }

    const created = [];

    for (let acct of data) {
      // ← ADDED: basic required‐fields validation per account
      if (
        !acct.accountCode ||
        !acct.accountName ||
        !acct.accType ||
        !acct.normalBalance
      ) {
        return res.status(400).json({
          status: 'failure',
          message:
            'accountCode, accountName, accType, and normalBalance are required.',
        });
      }

      // ← ADDED: parentAccount existence + leaf check
      if (acct.parentAccount) {
        const parent = await BB0_AccountModel.findById(
          acct.parentAccount
        ).lean();
        if (!parent) {
          return res
            .status(404)
            .json({ status: 'failure', message: 'Parent Account not found.' });
        }
        if (parent.isLeaf) {
          return res.status(422).json({
            status: 'failure',
            message: 'Parent Account cannot be a leaf.',
          });
        }
      }

      // ← ADDED: handle globalPartyId just like createAccount
      let partyId = acct.globalPartyId;
      if (!partyId) {
        const newParty = await BB0_GlobalPartyModel.create({
          name: acct.accountCode.trim(),
          partyType: ['Account'],
        });
        partyId = newParty._id;
      } else {
        const existingParty = await BB0_GlobalPartyModel.findById(partyId);
        if (!existingParty) {
          return res.status(404).json({
            status: 'failure',
            message: `GlobalParty ${partyId} not found.`,
          });
        }
        if (!existingParty.partyType.includes('Account')) {
          existingParty.partyType.push('Account');
          await existingParty.save();
        }
      }

      // ← CHANGED: build each doc and .save() to trigger pre-save hooks
      const newAcct = new BB0_AccountModel({
        globalPartyId: partyId,
        accountCode: acct.accountCode.trim(),
        accountName: acct.accountName.trim(),
        accType: acct.accType,
        parentAccount: acct.parentAccount || null,
        normalBalance: acct.normalBalance,
        isLeaf: acct.isLeaf === false ? false : true,
        allowManualPost: acct.allowManualPost === false ? false : true,
        currency: acct.currency ? acct.currency.trim() : 'INR',
        description: acct.description || '',
        group: acct.group || '',
      });

      await newAcct.save(); // ← this will run your counter hook & generate sysCode
      created.push(newAcct);
    }

    return res.status(201).json({
      status: 'success',
      message: `Inserted ${created.length} account(s).`,
      data: created,
    });
  } catch (error) {
    console.error('❌ bulkCreateAccounts Error:', error);
    // If a validation error occurs, Mongoose may throw a BulkWriteError with details.
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};

/**
 * 5) UPDATE ONE ACCOUNT BY ID
 */
export const updateAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: 'failure', message: 'Invalid ID' });
    }

    // ← ADDED: If they're updating parentAccount, validate it first
    if (req.body.parentAccount) {
      const parent = await BB0_AccountModel.findById(
        req.body.parentAccount
      ).lean();
      if (!parent) {
        return res
          .status(404)
          .json({ status: 'failure', message: 'Parent Account not found.' });
      }
      if (parent.isLeaf) {
        return res.status(422).json({
          status: 'failure',
          message: 'Parent Account cannot be a leaf.',
        });
      }
    }

    // Build an updates object only for allowed fields
    const updates = {};
    const allowedFields = [
      'accountCode',
      'accountName',
      'accType',
      'parentAccount',
      'normalBalance',
      'isLeaf',
      'allowManualPost',
      'currency',
      'description',
      'group',
    ];
    for (let f of allowedFields) {
      if (f in req.body) {
        updates[f] = req.body[f];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'No valid fields supplied for update.',
      });
    }

    const updated = await BB0_AccountModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Account not found.' });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Account updated.',
      data: updated,
    });
  } catch (error) {
    console.error('❌ updateAccountById Error:', error);
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};

/**
 * 6) BULK UPDATE ACCOUNTS
 *    Expect: { data: [ { _id, ...fieldsToUpdate }, ... ] }
 */
export const bulkUpdateAccounts = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Request body must contain a non-empty `data` array.');
    }

    const results = [];
    for (let entry of data) {
      const { _id, ...fields } = entry;
      if (!isValidObjectId(_id)) {
        throw new Error(`Invalid _id: ${_id}`);
      }

      // ← ADDED: If updating parentAccount, validate it
      if (fields.parentAccount) {
        const parent = await BB0_AccountModel.findById(fields.parentAccount)
          .session(session)
          .lean();
        if (!parent) {
          throw new Error(`Parent Account not found: ${fields.parentAccount}`);
        }
        if (parent.isLeaf) {
          throw new Error(
            `Parent Account cannot be a leaf: ${fields.parentAccount}`
          );
        }
      }

      // Only allow certain fields
      const updates = {};
      const allowedFields = [
        'accountCode',
        'accountName',
        'accType',
        'parentAccount',
        'normalBalance',
        'isLeaf',
        'allowManualPost',
        'currency',
        'description',
        'group',
      ];
      for (let f of allowedFields) {
        if (f in fields) {
          updates[f] = fields[f];
        }
      }
      if (Object.keys(updates).length === 0) {
        throw new Error(`No valid fields to update for ID ${_id}`);
      }

      const updated = await BB0_AccountModel.findByIdAndUpdate(_id, updates, {
        new: true,
        runValidators: true,
        session,
      });
      if (!updated) {
        throw new Error(`Account not found: ${_id}`);
      }
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      status: 'success',
      message: `Updated ${results.length} account(s).`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ bulkUpdateAccounts Error:', error);
    return res.status(400).json({ status: 'failure', message: error.message });
  }
};

// This is only archiving
export const archiveAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: 'failure', message: 'Invalid ID' });
    }
    const acct = await BB0_AccountModel.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    );
    if (!acct) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Account not found.' });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Account archived.',
      data: acct,
    });
  } catch (error) {
    console.error('❌ deleteAccountById Error:', error);
    return res.status(500).json({ status: 'failure', message: error.message });
  }
};

/**
 * 10) UNARCHIVE ONE (restore isArchived = false)
 */
export const unarchiveAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: 'failure', message: 'Invalid ID' });
    }
    const acct = await BB0_AccountModel.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true }
    );
    if (!acct) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Account not found.' });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Account unarchived.',
      data: acct,
    });
  } catch (error) {
    console.error('❌ unarchiveAccountById Error:', error);
    return res.status(500).json({ status: 'failure', message: error.message });
  }
};

/**
 * 7) DELETE ONE ACCOUNT (soft-delete → archive)
 *    We set isArchived = true
 */

/** Delete an Aisle by ID ACTUAL HARD DELETE */
export const deleteAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: 'failure', message: 'Invalid ID' });
    }
    const acct = await BB0_AccountModel.findByIdAndDelete(id);
    if (!acct) {
      return res
        .status(404)
        .json({ status: 'failure', message: '⚠️ acct not found.' });
    }

    // await createAuditLog({
    //   user: req.user?.username || "67ec2fb004d3cc3237b58772",
    //   module: "GL",
    //   action: "DELETE",
    //   recordId: acct._id,
    // });

    // await invalidateAccountCache();
    // winstonLogger.info(`ℹ️ Deleted acct: ${id}`);
    return res
      .status(200)
      .json({ status: 'success', message: '✅ acct deleted.' });
  } catch (error) {
    console.error('❌ Delete Account Error', error);
    return res.status(500).json({
      status: 'failure',
      message: 'Internal server error.',
      error: error.message,
    });
  }
};
/**
 * 8) BULK ACTUAL DELETE ACCOUNTS (soft‐delete → archive multiple)
 *    Expect: { ids: ["id1", "id2", ...] }
 */
export const bulkArchiveAccounts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'Request body must contain a non-empty `ids` array.',
      });
    }
    // Validate each ID
    for (let id of ids) {
      if (!isValidObjectId(id)) {
        return res
          .status(400)
          .json({ status: 'failure', message: `Invalid ID: ${id}` });
      }
    }
    const result = await BB0_AccountModel.updateMany(
      { _id: { $in: ids } },
      { isArchived: true }
    );
    return res.status(200).json({
      status: 'success',
      message: `Archived ${result.nModified} account(s).`,
    });
  } catch (error) {
    console.error('❌ bulkDeleteAccounts Error:', error);
    return res.status(500).json({ status: 'failure', message: error.message });
  }
};

/** 11) BULK-ACTUAL HARD DELETE ONLY “LEAF” ACCOUNTS (skip any with children) */
export const bulkAllDeleteAccounts = async (req, res) => {
  try {
    // find all parentAccount references
    const parents = await BB0_AccountModel.distinct('parentAccount', {
      parentAccount: { $ne: null },
    });
    // leaf = those _ids not in parents
    const leaves = await BB0_AccountModel.find({
      _id: { $nin: parents },
      isArchived: false,
    })
      .select('_id accountCode accountName')
      .lean();

    if (!leaves.length) {
      return res.status(200).json({
        status: 'success',
        message: 'No leaf accounts to delete.',
      });
    }

    const leafIds = leaves.map((a) => a._id);
    const del = await BB0_AccountModel.deleteMany({ _id: { $in: leafIds } });

    // recompute counter to max remaining systemCode
    const rem = await BB0_AccountModel.find({}, 'sysCode').lean();
    let max = 0;
    rem.forEach(({ sysCode }) => {
      const m = sysCode.match(/LA_(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const reset = await BB0_LedgerAccountCounterModel.findOneAndUpdate(
      { _id: 'bb0_glAccCode' },
      { seq: max },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: 'success',
      message: `Deleted ${del.deletedCount} leaf account(s).`,
      deleted: leaves,
      counter: reset.seq,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'failure', message: err.message });
  }
};

/** 12) BULK-HARD-DELETE ALL ACCOUNTS (cascade) */
export const bulkAllDeleteAccountsCascade = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const all = await BB0_AccountModel.find({}, '_id').session(session).lean();
    const ids = all.map((a) => a._id);

    if (!ids.length) {
      await session.commitTransaction();
      return res
        .status(200)
        .json({ status: 'success', message: 'No accounts to delete.' });
    }

    await BB0_AccountModel.deleteMany({ _id: { $in: ids } }).session(session);
    // reset counter to 0
    const reset = await BB0_LedgerAccountCounterModel.findOneAndUpdate(
      { _id: 'bb0_glAccCode' },
      { seq: 0 },
      { new: true, upsert: true, session }
    );

    await session.commitTransaction();
    return res.status(200).json({
      status: 'success',
      message: `Cascade-deleted ${ids.length} account(s).`,
      counter: reset.seq,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({ status: 'failure', message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * 13) DUPLICATE ONE ACCOUNT
 *     Creates a single copy of the given account (same parentAccount),
 *     appending "-copy-1" to its code so it remains unique.
 */
export const duplicateAccountById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ status: 'failure', message: 'Invalid ID' });
  }
  const orig = await BB0_AccountModel.findById(id).lean();
  if (!orig) {
    return res
      .status(404)
      .json({ status: 'failure', message: 'Account not found.' });
  }
  // 1) Create a fresh GlobalParty for the clone
  const newParty = await BB0_GlobalPartyModel.create({
    name: `${orig.accountCode}-copy-party`,
    partyType: ['Account'],
  });

  // 2) Build new accountCode
  const copyCode = `${orig.accountCode}-copy-1`;
  if (await BB0_AccountModel.exists({ accountCode: copyCode })) {
    return res.status(409).json({
      status: 'failure',
      message: `"${copyCode}" already exists.`,
    });
  }

  // 3) Create the clone with the new partyId
  const clone = await BB0_AccountModel.create({
    ...orig,
    _id: undefined,
    accountCode: copyCode,
    globalPartyId: newParty._id,
    createdAt: undefined,
    updatedAt: undefined,
  });

  return res.status(201).json({ status: 'success', data: clone });
};

/**
 * 14) REPLICATE ONE ACCOUNT N TIMES
 */
export const replicateAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    const { count } = req.body;
    if (!isValidObjectId(id) || typeof count !== 'number' || count < 1) {
      return res.status(400).json({
        status: 'failure',
        message: '`id` must be valid and `count` ≥ 1',
      });
    }

    const orig = await BB0_AccountModel.findById(id).lean();
    if (!orig) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Account not found.' });
    }

    const base = orig.accountCode.replace(/-copy-\d+$/, '');

    // 1) find existing copies
    const regex = new RegExp(`^${base}-copy-(\\d+)$`);
    const existing = await BB0_AccountModel.find(
      { accountCode: { $regex: regex } },
      'accountCode'
    ).lean();

    const used = existing
      .map((o) => {
        const m = o.accountCode.match(regex);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const start = used.length ? Math.max(...used) + 1 : 1;

    const clones = [];
    for (let i = 0; i < count; i++) {
      const idx = start + i;
      const copyCode = `${base}-copy-${idx}`;

      // 2) new GlobalParty for each clone
      const newParty = await BB0_GlobalPartyModel.create({
        name: `${copyCode}-party`,
        partyType: ['Account'],
      });

      // 3) create the clone
      const doc = {
        ...orig,
        _id: undefined,
        accountCode: copyCode,
        globalPartyId: newParty._id,
        createdAt: undefined,
        updatedAt: undefined,
      };
      const clone = await BB0_AccountModel.create(doc);
      clones.push(clone);
    }

    return res.status(201).json({ status: 'success', data: clones });
  } catch (err) {
    console.error('❌ replicateAccountById Error:', err);
    return res.status(500).json({ status: 'failure', message: err.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const { name, defaults } = req.body;
    if (!name || !defaults) {
      return res.status(400).json({
        status: 'failure',
        message: '`name` and `defaults` are required.',
      });
    }

    // Create the template
    const tpl = await BB0_AccountTemplateModel.create({
      name,
      defaults: {
        accountType: defaults.accType, // map incoming `accType` → `accountType`
        normalBalance: defaults.normalBalance,
        isLeaf: defaults.isLeaf,
        allowManualPost: defaults.allowManualPost,
        currency: defaults.currency,
        description: defaults.description,
        group: defaults.group,
      },
    });

    return res.status(201).json({ status: 'success', data: tpl });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        status: 'failure',
        message: `Template name "${req.body.name}" already exists.`,
      });
    }
    return res.status(500).json({ status: 'failure', message: err.message });
  }
};

/**
 * POST /bb0/api/v0/account-templates/:id/apply
 *
 * Apply a template to create a real account.  Optionally
 * allow `overrides: { accountCode, accountName, parentAccount }` in body.
 */

export const applyTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { overrides = {} } = req.body;

    // 1) Find the template
    const tpl = await BB0_AccountTemplateModel.findById(id).lean();
    if (!tpl) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Template not found.' });
    }

    // 2) Build the new account payload
    const payload = {
      accountCode: overrides.accountCode,
      accountName: overrides.accountName,
      accType: tpl.defaults.accountType,
      normalBalance: tpl.defaults.normalBalance,
      isLeaf: tpl.defaults.isLeaf,
      allowManualPost: tpl.defaults.allowManualPost,
      currency: tpl.defaults.currency,
      description: tpl.defaults.description,
      group: tpl.defaults.group,
      parentAccount: overrides.parentAccount || null,
    };

    // 3) **Generate a new globalPartyId** just like createAccount does
    const newParty = await BB0_GlobalPartyModel.create({
      name: payload.accountCode,
      partyType: ['Account'],
    });
    payload.globalPartyId = newParty._id;

    // 4) Now create the account (with a unique party)
    const newAcct = await BB0_AccountModel.create(payload);

    return res.status(201).json({ status: 'success', data: newAcct });
  } catch (err) {
    return res.status(err.code === 11000 ? 409 : 400).json({
      status: 'failure',
      message: err.message,
    });
  }
};

export const applyTemplate1_NOT_IN_USE = async (req, res) => {
  try {
    const { id } = req.params;
    const { overrides = {} } = req.body;

    // 1) Find the template
    const tpl = await BB0_AccountTemplateModel.findById(id).lean();
    if (!tpl) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Template not found.' });
    }

    // 2) Build the new account payload
    const payload = {
      accountCode: overrides.accountCode,
      accountName: overrides.accountName,
      accType: tpl.defaults.accountType,
      normalBalance: tpl.defaults.normalBalance,
      isLeaf: tpl.defaults.isLeaf,
      allowManualPost: tpl.defaults.allowManualPost,
      currency: tpl.defaults.currency,
      description: tpl.defaults.description,
      group: tpl.defaults.group,
      parentAccount: overrides.parentAccount || null,
    };

    // 3) Delegate to your existing `createAccount` logic
    //    (assuming it’s exposed as a function you can call)
    //    If not, you can inline similar validation here.
    const newAcct = await BB0_AccountModel.create(payload);

    return res.status(201).json({ status: 'success', data: newAcct });
  } catch (err) {
    // you can inspect err.name === 'ValidationError' etc.
    return res.status(400).json({ status: 'failure', message: err.message });
  }
};
/**
 * 12) CREATE A TEMPLATE
 *    POST /bb0/api/v0/account-templates
 */
export const createAccountTemplate_NOT_IN_USE = async (req, res) => {
  try {
    const { name, defaults } = req.body;
    if (!name || !defaults || !defaults.accType) {
      return res.status(400).json({
        status: 'failure',
        message:
          'Template `name` and at least `defaults.accType` are required.',
      });
    }
    const tpl = await BB0_AccountTemplateModel.create({ name, defaults });
    return res.status(201).json({
      status: 'success',
      message: 'Template created.',
      data: tpl,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        status: 'failure',
        message: `Template name "${req.body.name}" already exists.`,
      });
    }
    return res.status(500).json({ status: 'failure', message: err.message });
  }
};

/**
 * 13) APPLY A TEMPLATE
 *    POST /bb0/api/v0/accounts/apply-template
 *    Body: { templateId, accountCode, accountName, [overrides...] }
 */
export const applyAccountTemplate_NOT_IN_USE = async (req, res) => {
  try {
    const { templateId, accountCode, accountName, ...overrides } = req.body;
    if (!templateId || !accountCode || !accountName) {
      return res.status(400).json({
        status: 'failure',
        message: 'templateId, accountCode and accountName are required.',
      });
    }
    const tpl = await BB0_AccountTemplateModel.findById(templateId);
    if (!tpl) {
      return res.status(404).json({
        status: 'failure',
        message: `Template ${templateId} not found.`,
      });
    }
    // merge default template fields with overrides
    const body = {
      ...tpl.defaults.toObject(),
      accountCode,
      accountName,
      ...overrides,
    };
    // delegate to createAccount logic
    req.body = body;
    return createAccount(req, res);
  } catch (err) {
    return res.status(500).json({ status: 'failure', message: err.message });
  }
};
