import mongoose from "mongoose";
import { JournalTemplateModel } from "../models/journalTemplate.model.js";

/**
 * Create a new Journal Template
 */
export const createTemplate = async (req, res) => {
  try {
    const tpl = await JournalTemplateModel.create(req.body);
    return res.status(201).json({ status: "success", data: tpl });
  } catch (err) {
    console.error("❌ createTemplate Error:", err);
    if (err.name === "ValidationError") {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ status: "failure", message: "Template name must be unique." });
    }
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * Get list of all templates
 */
export const listTemplates = async (req, res) => {
  try {
    const templates = await JournalTemplateModel.find().lean();
    return res.status(200).json({ status: "success", data: templates });
  } catch (err) {
    console.error("❌ listTemplates Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * Get one template by ID
 */
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid template ID" });
    }
    const tpl = await JournalTemplateModel.findById(id).lean();
    if (!tpl) {
      return res
        .status(404)
        .json({ status: "failure", message: "Template not found." });
    }
    return res.status(200).json({ status: "success", data: tpl });
  } catch (err) {
    console.error("❌ getTemplateById Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * Update a template (PUT/PATCH)
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await JournalTemplateModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ status: "failure", message: "Template not found." });
    }
    return res.status(200).json({ status: "success", data: updated });
  } catch (err) {
    console.error("❌ updateTemplate Error:", err);
    if (err.name === "ValidationError") {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(500).json({ status: "failure", message: err.message });
  }
};

/**
 * Delete one template
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await JournalTemplateModel.findByIdAndDelete(id);
    if (!result) {
      return res
        .status(404)
        .json({ status: "failure", message: "Template not found." });
    }
    return res
      .status(200)
      .json({ status: "success", message: "Template deleted." });
  } catch (err) {
    console.error("❌ deleteTemplate Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};
