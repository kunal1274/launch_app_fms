// controllers/1_0_0/company.controller.js

//import { CompanyModel } from "../../models/1_0_0/company.1_0_0.model.js";
import { CompanyModel } from "../models/company.model.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";

/**
 * Create a new Company.
 * Required fields: companyCode, companyName, primaryGSTAddress, and email.
 */
export const createCompany = async (req, res) => {
  try {
    const companyData = req.body;

    // Validate required fields
    if (
      !companyData.companyCode ||
      !companyData.companyName ||
      !companyData.primaryGSTAddress ||
      !companyData.email
    ) {
      return res.status(422).json({
        status: "failure",
        message:
          "Company code, company name, primary GST address, and email are required.",
      });
    }

    // Create the company document
    const company = await CompanyModel.create(companyData);
    winstonLogger.info(`Company created successfully: ${company._id}`);
    return res.status(201).json({
      status: "success",
      message: "Company created successfully.",
      data: company,
    });
  } catch (error) {
    logError("Company Creation", error);
    if (error.name === "ValidationError") {
      return res.status(422).json({
        status: "failure",
        message: "Validation error during company creation.",
        error: error.message,
      });
    }
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Retrieve all Companies.
 */
export const getAllCompanies = async (req, res) => {
  try {
    const companies = await CompanyModel.find();
    winstonLogger.info(`Retrieved ${companies.length} companies.`);
    return res.status(200).json({
      status: "success",
      message: "Companies retrieved successfully.",
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    logError("Get All Companies", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Retrieve a Company by ID.
 */
export const getCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "Company not found.",
      });
    }
    winstonLogger.info(`Retrieved company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "Company retrieved successfully.",
      data: company,
    });
  } catch (error) {
    logError("Get Company By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Update a Company by ID.
 */
export const updateCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updateData = req.body;
    // Update the updatedBy field (assuming req.user is populated via authentication middleware)
    updateData.updatedBy = req.user?.username || "Unknown";
    const company = await CompanyModel.findByIdAndUpdate(
      companyId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "Company not found.",
      });
    }
    winstonLogger.info(`Updated company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "Company updated successfully.",
      data: company,
    });
  } catch (error) {
    logError("Update Company By ID", error);
    if (error.name === "ValidationError") {
      return res.status(422).json({
        status: "failure",
        message: "Validation error during company update.",
        error: error.message,
      });
    }
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Delete a Company by ID.
 */
export const deleteCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await CompanyModel.findByIdAndDelete(companyId);
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "Company not found.",
      });
    }
    winstonLogger.info(`Deleted company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "Company deleted successfully.",
    });
  } catch (error) {
    logError("Delete Company By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Archive a Company by ID.
 * This sets the "archived" field to true.
 */
export const archiveCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updateData = {
      archived: true,
      updatedBy: req.user?.username || "Unknown",
    };
    const company = await CompanyModel.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true }
    );
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "Company not found.",
      });
    }
    winstonLogger.info(`Archived company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "Company archived successfully.",
      data: company,
    });
  } catch (error) {
    logError("Archive Company", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Unarchive a Company by ID.
 * This sets the "archived" field to false.
 */
export const unarchiveCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updateData = {
      archived: false,
      updatedBy: req.user?.username || "Unknown",
    };
    const company = await CompanyModel.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true }
    );
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "Company not found.",
      });
    }
    winstonLogger.info(`Unarchived company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "Company unarchived successfully.",
      data: company,
    });
  } catch (error) {
    logError("Unarchive Company", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Retrieve archived Companies.
 */
export const getArchivedCompanies = async (req, res) => {
  try {
    const companies = await CompanyModel.find({ archived: true });
    winstonLogger.info(`Retrieved ${companies.length} archived companies.`);
    return res.status(200).json({
      status: "success",
      message: "Archived companies retrieved successfully.",
      data: companies,
    });
  } catch (error) {
    logError("Get Archived Companies", error);
    return res.status(500).json({
      status: "failure",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
