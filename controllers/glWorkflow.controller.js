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
