Below is an end-to-end example adding:

1. **Delegation** of an approval step to someone else
2. **Audit trail** (history) of every workflow action
3. A “Request Change” action

I’ve kept each file self-contained. Wherever you see `// ◀︎───` that’s where we’ve extended from the previous.

---

### 1. `models/glJournal.model.js`

```js
import mongoose, { Schema, model } from "mongoose";
import {
  GlobalNumberingModel,
  LocalNumberingModel,
  SharedNumberingModel,
} from "./counter.model.js";

// ——————————————————————————————————————————
// 1. GL Line (unchanged from last version except history removed for brevity)
// ——————————————————————————————————————————
const glLineSchema = new Schema(
  {
    /* … your existing fields … */
  },
  { _id: true }
);

// ——————————————————————————————————————————
// 2. Approval step + audit history
// ——————————————————————————————————————————
const approvalStepSchema = new Schema(
  {
    step: { type: Number, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"],
      default: "PENDING",
    },
    actedBy: { type: Schema.Types.ObjectId, ref: "Users" },
    actedAt: { type: Date },
    comment: { type: String },
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    ts: { type: Date, default: Date.now },
    user: { type: Schema.Types.ObjectId, ref: "Users" },
    action: { type: String }, // e.g. "SUBMIT","APPROVE","DELEGATE",...
    step: { type: Number },
    to: { type: Schema.Types.ObjectId, ref: "Users" }, // for delegation
    comment: { type: String },
  },
  { _id: false }
);

// ——————————————————————————————————————————
// 3. GL Journal
// ——————————————————————————————————————————
const glJournalSchema = new Schema(
  {
    globalJournalNum: { type: String, required: true, unique: true },
    localJournalNum: { type: String, required: true },
    localSharedOrderNum: { type: String },
    globalSharedOrderNum: { type: String },

    journalDate: { type: Date, default: Date.now, required: true },
    reference: { type: String, default: "" },
    createdBy: { type: String, default: "system", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Companies" },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "CHANGES_REQUESTED",
        "CANCELLED",
        "REVERSED",
        "ADJUSTED",
        "ADMIN_MODE",
        "ANY_MODE",
      ],
      default: "DRAFT",
      required: true,
    },
    active: { type: Boolean, default: false },
    allowSingleHeaderOnly: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },

    files: [
      /* … your existing file sub‐schema … */
    ],
    remarks: { type: String, default: "" },

    lines: { type: [glLineSchema], required: true },

    // — Workflow & history —
    submittedAt: { type: Date },
    currentStep: { type: Number, default: null },
    workflow: { type: [approvalStepSchema], default: [] }, // ◀︎─── new
    history: { type: [historySchema], default: [] }, // ◀︎─── new
  },
  {
    timestamps: true,
  }
);

// ——————————————————————————————————————————
// 4. Helpers on the schema
// ——————————————————————————————————————————
glJournalSchema.methods.initWorkflow = function (stepUsers, actorId) {
  this.submittedAt = new Date();
  this.currentStep = 1;
  this.workflow = stepUsers.map((u, i) => ({
    step: i + 1,
    assignedTo: u,
    status: "PENDING",
  }));
  this.history.push({
    user: actorId,
    action: "SUBMIT",
    comment: `Submitted for approval to steps [${stepUsers.join(",")}]`,
  });
};

glJournalSchema.methods.addHistory = function (entry) {
  this.history.push({
    ts: new Date(),
    ...entry,
  });
};

// ——————————————————————————————————————————
// 5. Numbering & line assignment & single-header validation
// ——————————————————————————————————————————
glJournalSchema.pre("validate", async function (next) {
  if (this.isNew) {
    // … global/local/shared numbering, as before …
  }

  // single-header rule
  if (this.allowSingleHeaderOnly) {
    const c = this.lines.filter((l) => l.isHeader).length;
    if (c > 1) {
      return next(
        new Error(
          "Only one header line is allowed when allowSingleHeaderOnly is checked."
        )
      );
    }
  }

  // lineNum & sequence …
  this.lines.forEach((ln, idx) => {
    ln.lineNum = idx + 1;
    if (ln.sequence == null) ln.sequence = idx + 1;
  });

  next();
});

// ——————————————————————————————————————————
// 6. DR/CR balance & qty group‐sum checks
// ——————————————————————————————————————————
glJournalSchema.pre("save", function (next) {
  // … your existing DR=CR and qty‐group checks …
  next();
});

// ——————————————————————————————————————————
// 7. Indexes
// ——————————————————————————————————————————
glJournalSchema.index({ journalDate: 1, createdBy: 1 });
glJournalSchema.index({ globalJournalNum: 1 });
glJournalSchema.index({ localJournalNum: 1 });
glJournalSchema.index({ localSharedOrderNum: 1 });
glJournalSchema.index({ globalSharedOrderNum: 1 });

export const GLJournalModel =
  mongoose.models.GLJournals || model("GLJournals", glJournalSchema);
```

---

### 2. `controllers/glJournalWorkflow.controller.js`

```js
import mongoose from "mongoose";
import { GLJournalModel } from "../models/glJournal.model.js";

/**
 * Submit a DRAFT for approval.
 */
export const submitForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const stepUsers = req.body.stepUsers; // [ userId1, userId2, … ]
    if (!Array.isArray(stepUsers) || stepUsers.length === 0) {
      return res.status(400).send("Must supply an array of approver IDs");
    }

    const j = await GLJournalModel.findById(id);
    if (!j) return res.status(404).send("Not found");
    if (j.status !== "DRAFT") {
      return res.status(400).send("Only DRAFT can be submitted");
    }

    j.initWorkflow(stepUsers, req.user._id);
    j.status = "PENDING_APPROVAL";
    await j.save();
    res.json({ status: "success", data: j });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * Act on an approval step: approve, reject, or request changes.
 */
export const actOnApproval = async (req, res) => {
  try {
    const { id, step } = req.params;
    const { action, comment } = req.body;
    const valid = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"];
    if (!valid.includes(action)) {
      return res.status(400).send("action must be one of " + valid.join());
    }

    const j = await GLJournalModel.findById(id);
    if (!j) return res.status(404).send("Not found");
    if (j.currentStep !== +step) {
      return res.status(400).send("Not this step’s turn");
    }

    const stepDoc = j.workflow.find((s) => s.step === +step);
    stepDoc.status = action;
    stepDoc.actedBy = req.user._id;
    stepDoc.actedAt = new Date();
    stepDoc.comment = comment;

    j.addHistory({
      user: req.user._id,
      action,
      step: +step,
      comment,
    });

    if (action === "APPROVED") {
      const next = j.workflow.find((s) => s.step === +step + 1);
      if (next) {
        j.currentStep = next.step;
      } else {
        j.currentStep = null;
        j.status = "APPROVED";
      }
    } else {
      // either REJECTED or CHANGES_REQUESTED
      j.currentStep = null;
      j.status = action;
    }

    await j.save();
    res.json({ status: "success", data: j });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * Delegate the current step to another user.
 */
export const delegateStep = async (req, res) => {
  try {
    const { id, step } = req.params;
    const { to } = req.body; // userId

    const j = await GLJournalModel.findById(id);
    if (!j) return res.status(404).send("Not found");
    if (j.currentStep !== +step) {
      return res.status(400).send("Not this step’s turn");
    }

    const stepDoc = j.workflow.find((s) => s.step === +step);
    const prevAssignee = stepDoc.assignedTo;
    stepDoc.assignedTo = to;

    j.addHistory({
      user: req.user._id,
      action: "DELEGATE",
      step: +step,
      to,
      comment: `Was ${prevAssignee} now ${to}`,
    });

    await j.save();
    res.json({ status: "success", data: j });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * Recall a submission back to DRAFT.
 */
export const recallSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const j = await GLJournalModel.findById(id);
    if (!j) return res.status(404).send("Not found");
    if (!["PENDING_APPROVAL", "CHANGES_REQUESTED"].includes(j.status)) {
      return res.status(400).send("Cannot recall in current status");
    }

    j.addHistory({ user: req.user._id, action: "RECALL" });
    j.status = "DRAFT";
    j.submittedAt = null;
    j.currentStep = null;
    j.workflow = [];
    await j.save();
    res.json({ status: "success", data: j });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
};
```

---

### 3. New routes in `routes/glJournal.routes.js`

```js
import express from "express";
import * as WF from "../controllers/glJournalWorkflow.controller.js";
import * as GL from "../controllers/glJournal.controller.js";
const router = express.Router();

router.post("/", GL.createGLJournal);
router.get("/:id", GL.getGLJournalById);
// … your other CRUD routes …

// ───── Workflow ───────────────────────────────────
router.post("/:id/submit", WF.submitForApproval);
router.post("/:id/step/:step/act", WF.actOnApproval);
router.post("/:id/step/:step/delegate", WF.delegateStep);
router.post("/:id/recall", WF.recallSubmission);

export default router;
```

---

#### How it works in practice

1. **Submit**:

   ```http
   POST /gljournals/60f1…/submit
   { "stepUsers":["5f8a…","5f8b…","5f8c…"] }
   ```

   - Builds a 3-step workflow. `currentStep=1`, `status="PENDING_APPROVAL"`.

2. **Approve step 1**:

   ```http
   POST /gljournals/60f1…/step/1/act
   { "action":"APPROVED", "comment":"Looks good" }
   ```

   - Marks step 1 approved, advances to `currentStep=2`.

3. **Delegate step 2**:

   ```http
   POST /gljournals/60f1…/step/2/delegate
   { "to":"5f8d…" }
   ```

   - Reassigns step 2→ user `5f8d…`, logs a history entry.

4. **Reject on step 3** or **Request changes**:

   ```http
   POST /gljournals/60f1…/step/3/act
   { "action":"CHANGES_REQUESTED", "comment":"Need more backup docs" }
   ```

   - Marks final status `"CHANGES_REQUESTED"`, clears `currentStep`.

5. **Recall**

   ```http
   POST /gljournals/60f1…/recall
   ```

   - Puts the journal back into `"DRAFT"`, wipes out `workflow` array.

All steps and comments are stored in `journal.history` for a full audit trail.

---

This gives you a robust, multi-stage approval workflow with delegation, change-requests, rejects, recalls, and a full history log. Let me know what other workflow features you’d like to add!
