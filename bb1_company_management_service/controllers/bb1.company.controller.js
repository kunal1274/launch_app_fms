// controllers/company.controller.js

import mongoose from "mongoose";
import { CompanyModel } from "../models/bb1.company.model.js";
import { GlobalPartyModel } from "../../bb1_shared_management_service/models/bb1.globalParty.model.js";
import { createAuditLog } from "../../bb1_audit_logging_service/utils/bb1.auditLogger.utils.js";
import redisClient from "../../bb1_shared_management_service/middleware/bb1.redisClient.js";
import { logStackError } from "../../bb1_shared_management_service/utility/bb1.logError.utils.js";
import logger, {
  loggerJsonFormat,
} from "../../bb1_shared_management_service/utility/bb1.logger.util.js";

// // redis related things will be commented for while
// const CACHE_KEY = (req) => `${req.method}:${req.originalUrl}`;

/**
 * POST /companies
 */
export const createCompany = async (req, res) => {
  try {
    let {
      companyCode,
      companyName,
      primaryGSTAddress,
      email,
      globalPartyId,
      ...rest
    } = req.body;

    if (!companyCode || !companyName || !primaryGSTAddress || !email) {
      return res.status(422).json({
        status: "failure",
        message:
          "⚠️ companyCode, companyName, primaryGSTAddress, and email are required.",
      });
    }

    companyCode = companyCode.trim().toUpperCase();
    companyName = companyName.trim();
    email = email.trim().toLowerCase();

    let partyId;
    if (!globalPartyId) {
      const newParty = await GlobalPartyModel.create({
        name: companyName,
        partyType: ["Company"],
      });
      partyId = newParty._id;
    } else {
      if (!mongoose.Types.ObjectId.isValid(globalPartyId)) {
        return res.status(400).json({
          status: "failure",
          message: `⚠️ Invalid globalPartyId: ${globalPartyId}`,
        });
      }
      const existing = await GlobalPartyModel.findById(globalPartyId);
      if (!existing) {
        return res.status(404).json({
          status: "failure",
          message: `⚠️ GlobalParty ${globalPartyId} not found.`,
        });
      }
      if (!existing.partyType.includes("Company")) {
        existing.partyType.push("Company");
        await existing.save();
      }
      partyId = existing._id;
    }

    const company = await CompanyModel.create({
      companyCode,
      companyName,
      primaryGSTAddress,
      email,
      globalPartyId: partyId,
      ...rest,
    });

    // Audit log for creation
    await createAuditLog({
      user: req.user?.username || "System",
      module: "Company",
      action: "CREATE",
      recordId: company._id,
      changes: { newData: company },
    });

    // // redis
    // await redisClient.del("/companies");

    logger.info("✅ Company created", { companyId: company._id });
    loggerJsonFormat.info("✅ Company created", { companyId: company._id });

    return res.status(201).json({
      status: "success",
      message: "✅ Company created successfully.",
      data: company,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("Company create validation", error);
      return res.status(422).json({
        status: "failure",
        message: "❌ Validation error.",
        error: error.message,
      });
    }
    if (error.code === 11000) {
      logStackError("Company create duplicate", error);
      return res.status(409).json({
        status: "failure",
        message: "❌ companyCode or email already exists.",
      });
    }
    if (error.message?.includes("network error")) {
      logStackError("Company create network", error);
      return res.status(503).json({
        status: "failure",
        message: "❌ Service unavailable. Try again later.",
      });
    }
    logStackError("Company create unknown", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * GET /companies
 */
export const getAllCompanies = async (req, res) => {
  // redis
  // const key = CACHE_KEY(req);
  try {
    // const cached = await redisClient.get(key);
    // if (cached) {
    //   const data = JSON.parse(cached);
    //   return res.status(200).json({
    //     status: "success",
    //     message: "✅ Companies retrieved (cache).",
    //     count: data.length,
    //     data,
    //     cached: true,
    //   });
    // }

    const companies = await CompanyModel.find();
    // await redisClient.set(key, JSON.stringify(companies), { EX: 300 });
    return res.status(200).json({
      status: "success",
      message: "✅ Companies retrieved.",
      count: companies.length,
      data: companies,
      cached: false,
    });
  } catch (error) {
    logStackError("Get all companies", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * GET /companies/:companyId
 */
export const getCompanyById = async (req, res) => {
  const { companyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.status(400).json({
      status: "failure",
      message: `⚠️ Invalid companyId: ${companyId}`,
    });
  }
  try {
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "⚠️ Company not found.",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "✅ Company retrieved.",
      data: company,
    });
  } catch (error) {
    logStackError("Get company by ID", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * PUT /companies/:companyId
 */
export const updateCompanyById = async (req, res) => {
  const { companyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.status(400).json({
      status: "failure",
      message: `⚠️ Invalid companyId: ${companyId}`,
    });
  }
  try {
    if (req.body.companyCode) {
      req.body.companyCode = req.body.companyCode.trim().toUpperCase();
    }
    if (req.body.companyName) {
      req.body.companyName = req.body.companyName.trim();
    }
    if (req.body.email) {
      req.body.email = req.body.email.trim().toLowerCase();
    }
    req.body.updatedBy = req.user?.username || "Unknown";

    const company = await CompanyModel.findByIdAndUpdate(companyId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "⚠️ Company not found.",
      });
    }

    // Audit log for update
    await createAuditLog({
      user: req.user?.username || "System",
      module: "Company",
      action: "UPDATE",
      recordId: company._id,
      changes: { newData: company },
    });
    // redis
    // await redisClient.del("/companies");

    return res.status(200).json({
      status: "success",
      message: "✅ Company updated successfully.",
      data: company,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({
        status: "failure",
        message: "❌ Validation error.",
        error: error.message,
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        status: "failure",
        message: "❌ Duplicate companyCode or email.",
      });
    }
    logStackError("Update company", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * DELETE /companies/:companyId
 */
export const deleteCompanyById = async (req, res) => {
  const { companyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.status(400).json({
      status: "failure",
      message: `⚠️ Invalid companyId: ${companyId}`,
    });
  }
  try {
    const company = await CompanyModel.findByIdAndDelete(companyId);
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "⚠️ Company not found.",
      });
    }

    // Audit log for deletion
    await createAuditLog({
      user: req.user?.username || "System",
      module: "Company",
      action: "DELETE",
      recordId: company._id,
      changes: { oldData: company },
    });

    // // redis
    // await redisClient.del("/companies");

    return res.status(200).json({
      status: "success",
      message: "✅ Company deleted successfully.",
    });
  } catch (error) {
    logStackError("Delete company", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * PATCH /companies/:companyId/archive
 */
export const archiveCompanyById = async (req, res) => {
  const { companyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.status(400).json({
      status: "failure",
      message: `⚠️ Invalid companyId: ${companyId}`,
    });
  }
  try {
    const company = await CompanyModel.findByIdAndUpdate(
      companyId,
      { archived: true, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "⚠️ Company not found.",
      });
    }

    // Audit log for archive
    await createAuditLog({
      user: req.user?.username || "System",
      module: "Company",
      action: "ARCHIVE",
      recordId: company._id,
      changes: { newData: company },
    });

    // await redisClient.del("/companies");

    return res.status(200).json({
      status: "success",
      message: "✅ Company archived successfully.",
      data: company,
    });
  } catch (error) {
    logStackError("Archive company", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * PATCH /companies/:companyId/unarchive
 */
export const unarchiveCompanyById = async (req, res) => {
  const { companyId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.status(400).json({
      status: "failure",
      message: `⚠️ Invalid companyId: ${companyId}`,
    });
  }
  try {
    const company = await CompanyModel.findByIdAndUpdate(
      companyId,
      { archived: false, updatedBy: req.user?.username || "Unknown" },
      { new: true }
    );
    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "⚠️ Company not found.",
      });
    }

    // Audit log for unarchive
    await createAuditLog({
      user: req.user?.username || "System",
      module: "Company",
      action: "UNARCHIVE",
      recordId: company._id,
      changes: { newData: company },
    });
    // // redis
    //     await redisClient.del("/companies");

    return res.status(200).json({
      status: "success",
      message: "✅ Company unarchived successfully.",
      data: company,
    });
  } catch (error) {
    logStackError("Unarchive company", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};

/**
 * GET /companies/archived
 */
export const getArchivedCompanies = async (req, res) => {
  try {
    const companies = await CompanyModel.find({ archived: true });
    return res.status(200).json({
      status: "success",
      message: "✅ Archived companies retrieved.",
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    logStackError("Get archived companies", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal server error.",
      error: error.message,
    });
  }
};
