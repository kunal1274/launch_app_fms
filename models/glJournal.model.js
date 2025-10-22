// models/glJournal.model.js

import mongoose, { Schema, model } from 'mongoose';
import {
  GlobalNumberingModel,
  LocalNumberingModel,
  SharedNumberingModel,
} from './counter.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Define the sub‐schema for each GL line
// ─────────────────────────────────────────────────────────────────────────────
const glLineSchema = new Schema(
  {
    // accountCode: {
    //   type: String,
    //   required: [true, "Each line must specify an accountCode."],
    //   trim: true,
    // },
    // sequential line number assigned on save
    lineNum: { type: Number, required: true },
    // custom sequence if user wants different ordering
    sequence: { type: Number, required: true },
    parentLineNum: { type: Number }, // for hidden breakdowns (tax, discount, charges, etc.)
    isHeader: { type: Boolean, default: false },
    remarks: {
      type: String,
      required: false,
      default: '',
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      required: true,
      // We store the actual Account _id instead of the bare string code.
    },

    // your “order” dimensions:
    qty: { type: Number, required: true },
    secondaryQty: { type: Number, default: 0 },
    unitPrice: { type: Number, required: true },
    secondaryUnitPrice: { type: Number, default: 0 },

    // overrideable “base” value:
    assessableValue: { type: Number, required: true },

    // tax/discount/charges inputs:
    gstPercent: { type: Number, default: 0 },
    tdsPercent: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    chargePercent: { type: Number, default: 0 },

    // codes for subledger mapping
    gstCode: { type: String },
    tdsCode: { type: String },
    hsnCode: { type: String },
    sacCode: { type: String },
    chargesCode: { type: String },
    discountCode: { type: String },

    // computed outputs:
    discountAmount: { type: Number, default: 0 },
    chargesAmount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    tdsAmount: { type: Number, default: 0 },

    debit: {
      type: Number,
      default: 0,
      min: [0, 'Debit cannot be negative.'],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, 'Credit cannot be negative.'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required on each line.'],
      trim: true,
    },
    exchangeRate: {
      // Rate to convert from line’s currency into functional currency.
      // e.g., if functional currency is INR and line currency is USD, exchangeRate = 75 means 1 USD = 75 INR.
      type: Number,
      required: [true, 'Exchange rate is required.'],
      min: [0, 'Exchange rate must be non-negative.'],
    },
    localAmount: {
      // This must equal (debit − credit) × exchangeRate, rounded to two decimals.
      type: Number,
      required: [
        true,
        'Local amount is required (debit − credit) × exchangeRate.',
      ],
    },

    // ← NEW optional sub‐ledger links on each line
    item: { type: Schema.Types.ObjectId, ref: 'Items' },
    customer: { type: Schema.Types.ObjectId, ref: 'Customers' },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendors' },
    bankAccount: { type: Schema.Types.ObjectId, ref: 'Banks' },

    // Link to subledger (if any)
    subledger: {
      sourceType: {
        type: String,
        enum: ['AR', 'AP', 'BANK_TRANSFER', 'FX_REVAL'],
        default: null,
      },
      txnId: {
        type: Schema.Types.ObjectId,
      },
      lineNum: {
        type: Number,
      },
    },

    // OPTIONAL: If you want to link an inventory dimension to this GL line,
    // copy/paste the dims object from your voucher model:
    dims: {
      site: { type: Schema.Types.ObjectId, ref: 'Sites' },
      warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouses' },
      zone: { type: Schema.Types.ObjectId, ref: 'Zones' },
      location: { type: Schema.Types.ObjectId, ref: 'Locations' },
      aisle: { type: Schema.Types.ObjectId, ref: 'Aisles' },
      rack: { type: Schema.Types.ObjectId, ref: 'Racks' },
      shelf: { type: Schema.Types.ObjectId, ref: 'Shelves' },
      bin: { type: Schema.Types.ObjectId, ref: 'Bins' },
      config: { type: Schema.Types.ObjectId, ref: 'Configurations' },
      color: { type: Schema.Types.ObjectId, ref: 'Colors' },
      size: { type: Schema.Types.ObjectId, ref: 'Sizes' },
      style: { type: Schema.Types.ObjectId, ref: 'Styles' },
      version: { type: Schema.Types.ObjectId, ref: 'Versions' },
      batch: { type: Schema.Types.ObjectId, ref: 'Batches' },
      serial: { type: Schema.Types.ObjectId, ref: 'Serials' },
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
    archived: { type: Boolean, default: false }, // New field
    status: {
      type: String,
      enum: [
        'DRAFT',
        'POSTED',
        'CANCELLED',
        'REVERSED',
        'ADJUSTED',
        'ADMIN_MODE',
        'ANY_MODE',
      ],
      default: 'DRAFT',
      required: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Companies',
    },

    files: [
      {
        fileName: { type: String, required: true }, // Name of the file
        fileOriginalName: { type: String, required: true },
        fileType: { type: String, required: true }, // MIME type (e.g., "application/pdf", "image/png")
        fileUrl: { type: String, required: true }, // URL/path of the uploaded file
        fileUploadedAt: { type: Date, default: Date.now }, // Timestamp for the upload
      },
    ],
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Companies',
    },

    // Extra metadata—could store sub-ledger IDs or notes
    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

// assign lineNum sequentially
glLineSchema.pre('validate', function (next) {
  // nothing here – handled at parent level
  const hasAcct = !!this.account;
  const hasSub = !!this.subledger?.subledgerType;
  if ((hasAcct ^ hasSub) !== 1) {
    return next(
      new mongoose.Error.ValidationError(
        new Error(
          'Each line must have exactly one of `account` or `subledger` defined.'
        )
      )
    );
  }
  next();
});

// ——————————————————————————————————————————
// 2. Approval step + audit history
// ——————————————————————————————————————————
const approvalStepSchema = new Schema(
  {
    step: { type: Number, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
      default: 'PENDING',
    },
    actedBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    actedAt: { type: Date },
    comment: { type: String },
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    ts: { type: Date, default: Date.now },
    user: { type: Schema.Types.ObjectId, ref: 'Users' },
    action: { type: String }, // e.g. "SUBMIT","APPROVE","DELEGATE",...
    step: { type: Number },
    to: { type: Schema.Types.ObjectId, ref: 'Users' }, // for delegation
    comment: { type: String },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Define the top‐level GL Journal schema
// ─────────────────────────────────────────────────────────────────────────────
const glJournalSchema = new Schema(
  {
    // **New**: link back to the template
    template: {
      type: Schema.Types.ObjectId,
      ref: 'JournalTemplates',
      required: false,
    },
    globalJournalNum: { type: String, required: true, unique: true }, // "GJ-000001" across company for across company journal inc
    localJournalNum: { type: String, required: true }, // "LAJ-000001" within company for journal inc
    localSharedOrderNum: { type: String }, // "SAH-000001" within company for any shared booking inc
    globalSharedOrderNum: { type: String }, // "GSH-000001" across company for across company shared booking inc

    // copy‐across from template:
    allowHeader: { type: Boolean, default: true },
    mandatorySingleHeader: { type: Boolean, default: false },
    workflowRequired: { type: Boolean, default: false },
    workflowStages: {
      type: [
        new Schema(
          { sequence: Number, key: String, label: String },
          { _id: false }
        ),
      ],
      default: [],
    },
    statusTransitions: { type: Map, of: [String], default: {} },

    allowSingleHeaderOnly: {
      type: Boolean,
      required: true,
      default: false,
    },
    journalDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      required: true,
      default: 'system', // you can override with req.user
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Companies',
    },

    // NEW status field
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'CHANGES_REQUESTED',
        'POSTED',
        'CANCELLED',
        'REVERSED',
        'ADJUSTED',
        'ADMIN_MODE',
        'ANY_MODE',
      ],
      default: 'DRAFT',
      required: true,
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },

    archived: { type: Boolean, default: false }, // New field
    files: [
      {
        fileName: { type: String, required: true }, // Name of the file
        fileOriginalName: { type: String, required: true },
        fileType: { type: String, required: true }, // MIME type (e.g., "application/pdf", "image/png")
        fileUrl: { type: String, required: true }, // URL/path of the uploaded file
        fileUploadedAt: { type: Date, default: Date.now }, // Timestamp for the upload
      },
    ],
    remarks: {
      type: String,
      required: false,
      default: '',
    },
    lines: {
      // Must have at least one line
      type: [glLineSchema],
      required: [true, 'A GL Journal must have at least one line.'],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'A GL Journal must have at least one line.',
      },
    },
    // — Workflow & history —
    submittedAt: { type: Date },
    currentStep: { type: Number, default: null },
    workflow: { type: [approvalStepSchema], default: [] }, // ◀︎─── new
    history: { type: [historySchema], default: [] }, // ◀︎─── new
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ——————————————————————————————————————————
// 4. Helpers on the schema
// ——————————————————————————————————————————

// ───────────────────────────────────────────────────
// when user “submits” a DRAFT for approval, we:
//  • set submittedAt = now
//  • set currentStep = 1
//  • initialize workflow[] from a per-company template (or hard-code here)
// ───────────────────────────────────────────────────

glJournalSchema.methods.initWorkflow = function (stepUsers, actorId) {
  this.submittedAt = new Date();
  this.currentStep = 1;
  this.workflow = stepUsers.map((u, i) => ({
    step: i + 1,
    assignedTo: u,
    status: 'PENDING',
  }));
  this.history.push({
    user: actorId,
    action: 'SUBMIT',
    comment: `Submitted for approval to steps [${stepUsers.join(',')}]`,
  });
};

glJournalSchema.methods.addHistory = function (entry) {
  this.history.push({
    ts: new Date(),
    ...entry,
  });
};

// ───────────────────────────────────────────────────
// 3) Auto‐generate all four numbers & assign lineNum/sequence
// ───────────────────────────────────────────────────
glJournalSchema.pre('validate', async function (next) {
  if (this.isNew) {
    // 1) GJ
    const g = await GlobalNumberingModel.findOneAndUpdate(
      { _id: 'GJ' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.globalJournalNum = `GJ-${String(g.seq).padStart(6, '0')}`;

    // 2) Local JN (uses company code)
    const companyCode =
      this.company?.toString().slice(-3).toUpperCase() || 'LX';
    const ljId = `LJ_${companyCode}`;
    const l = await LocalNumberingModel.findOneAndUpdate(
      { _id: ljId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.localJournalNum = `LJ${companyCode}-${String(l.seq).padStart(6, '0')}`;

    // 3) Shared order per company
    const shId = `SH_${companyCode}`;
    const sh = await SharedNumberingModel.findOneAndUpdate(
      { _id: shId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.localSharedOrderNum = `SH${companyCode}-${String(sh.seq).padStart(
      6,
      '0'
    )}`;

    // 4) Global shared
    const gs = await GlobalNumberingModel.findOneAndUpdate(
      { _id: 'GSH' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.globalSharedOrderNum = `GSH-${String(gs.seq).padStart(6, '0')}`;
  }

  // 2) If a template was provided, pull its settings:
  if (this.template) {
    const tpl = await mongoose
      .model('JournalTemplates')
      .findById(this.template)
      .lean();
    if (!tpl) {
      return next(new Error('Invalid templateId'));
    }
    this.allowHeader = tpl.allowHeader;
    this.mandatorySingleHeader = tpl.mandatorySingleHeader;
    this.workflowRequired = tpl.workflowRequired;
    this.workflowStages = tpl.stages;
    this.statusTransitions = tpl.statusTransitions;
  }

  // —— enforce single-header if flagged ——
  if (
    this.allowSingleHeaderOnly ||
    (this.allowHeader && this.mandatorySingleHeader)
  ) {
    const headerCount = this.lines.filter((l) => l.isHeader).length;
    if (headerCount > 1) {
      return next(
        new mongoose.Error.ValidationError(
          new Error(
            'Only one header line is allowed when allowSingleHeaderOnly is checked.'
          )
        )
      );
    }
  }

  // assign lineNum & default sequence
  this.lines.forEach((ln, idx) => {
    ln.lineNum = idx + 1;
    if (ln.sequence == null) ln.sequence = idx + 1;
  });

  // // balance check
  // let dr = 0,
  //   cr = 0;
  // this.lines.forEach((l) => {
  //   dr += l.debit;
  //   cr += l.credit;
  // });
  // dr = Math.round(dr * 100) / 100;
  // cr = Math.round(cr * 100) / 100;
  // if (dr !== cr) {
  //   return next(
  //     new mongoose.Error.ValidationError(
  //       new Error(`Unbalanced totalDebits (${dr}) ≠ totalCredits (${cr})`)
  //     )
  //   );
  // }

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pre-save hook: ensure total debits = total credits
// ─────────────────────────────────────────────────────────────────────────────
glJournalSchema.pre('save', function (next) {
  // const journal = this;
  // let totalDebits = 0;
  // let totalCredits = 0;

  // journal.lines.forEach((ln) => {
  //   totalDebits += ln.debit;
  //   totalCredits += ln.credit;
  // });

  // // Round to 2 decimals before comparison
  // totalDebits = Math.round(totalDebits * 100) / 100;
  // totalCredits = Math.round(totalCredits * 100) / 100;

  // if (totalDebits !== totalCredits) {
  //   // Construct a validation error:
  //   const err = new mongoose.Error.ValidationError(
  //     new Error(
  //       `Unbalanced GL Journal: totalDebits (${totalDebits.toFixed(
  //         2
  //       )}) ≠ totalCredits (${totalCredits.toFixed(2)})`
  //     )
  //   );
  //   return next(err);
  // }

  // // after you assign lineNum…
  // const groups = {};
  // this.lines.forEach((ln) => {
  //   // use parentLineNum if set, else own lineNum as group key
  //   const key = ln.parentLineNum || ln.lineNum;
  //   groups[key] = (groups[key] || 0) + ln.qty;
  // });

  // for (let k in groups) {
  //   if (Math.round(groups[k] * 100) / 100 !== 0) {
  //     return next(new Error(`Lines in group ${k} qty‐sum(${groups[k]}) ≠ 0`));
  //   }
  // }
  // this.lines.forEach((ln, idx) => (ln.lineNum = idx + 1));

  // a) DR/CR balance
  let dr = 0,
    cr = 0;
  this.lines.forEach((l) => {
    dr += l.debit;
    cr += l.credit;
  });
  dr = Math.round(dr * 100) / 100;
  cr = Math.round(cr * 100) / 100;
  if (dr !== cr) {
    return next(
      new mongoose.Error.ValidationError(
        new Error(`Unbalanced GL Journal: DR(${dr}) ≠ CR(${cr})`)
      )
    );
  }

  // b) Header → children grouping
  //    If multiple `isHeader=true` in a row, each simply resets the group.
  let currentHdr = null;
  this.lines.sort((a, b) => a.sequence - b.sequence);
  this.lines.forEach((ln) => {
    if (ln.isHeader) {
      currentHdr = ln.lineNum;
      ln.parentLineNum = null;
    } else {
      ln.parentLineNum = currentHdr;
    }
  });

  // c) QTY zero‐sum per group
  const headerExists = this.lines.some((l) => l.isHeader);
  if (headerExists) {
    const groups = {};
    this.lines.forEach((ln) => {
      const key = ln.parentLineNum ?? ln.lineNum;
      groups[key] = (groups[key] || 0) + ln.qty;
    });
    for (let grp in groups) {
      if (Math.round(groups[grp] * 100) / 100 !== 0) {
        return next(new Error(`Group ${grp} qty‐sum(${groups[grp]}) ≠ 0`));
      }
    }
  }

  next();
});

// glJournalSchema.pre(/^find/, function (next) {
//   this.populate("account", "sysCode accountCode accountName");
//   next();
// });

// // Optional: index to speed queries by date or creator
// glJournalSchema.index({ journalDate: 1, createdBy: 1, globalJournalNum: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// 5) Indexes
// ─────────────────────────────────────────────────────────────────────────────
glJournalSchema.index({ journalDate: 1, createdBy: 1 });
glJournalSchema.index({ globalJournalNum: 1 });
glJournalSchema.index({ localJournalNum: 1 });
glJournalSchema.index({ localSharedOrderNum: 1 });
glJournalSchema.index({ globalSharedOrderNum: 1 });

export const GLJournalModel =
  mongoose.models.GLJournals || model('GLJournals', glJournalSchema);
