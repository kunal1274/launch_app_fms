// controllers/1_0_0/company.controller.js

//import { CompanyModel } from "../../models/1_0_0/company.1_0_0.model.js";
import { createAuditLog } from "../audit_logging_service/utils/auditLogger.utils.js";
import { dbgRedis } from "../index.js";
import redisClient from "../middleware/redisClient.js";
import { CompanyModel } from "../models/company.model.js";
import { GlobalPartyModel } from "../shared_service/models/globalParty.model.js";
import { winstonLogger, logError } from "../utility/logError.utils.js";
import logger, {
  loggerJsonFormat,
  logStackError,
} from "../utility/logger.util.js";
import mongoose from "mongoose";

/**
 * INVALIDATE CACHE HELPER
 */
const invalidateCompanyCache = async (key = "/fms/api/v0/companies") => {
  try {
    await redisClient.del(key);
    logger.info(`Cache invalidated: ${key}`, { context: "invalidateCache" });
  } catch (err) {
    logStackError("❌ Cache invalidation failed", err);
  }
};

/**
 * Create a new Company.
 * Required fields: companyCode, companyName, primaryGSTAddress, and email.
 */
export const createCompany_V1 = async (req, res) => {
  try {
    const companyData = req.body;

    // Validate required fields
    if (
      !companyData.companyCode ||
      !companyData.companyName ||
      !companyData.primaryGSTAddress ||
      !companyData.email
    ) {
      logger.warn("Company Creation - ⚠️ Missing Required Fields", {
        context: "createCompany",
        body: companyData,
      });

      loggerJsonFormat.warn(
        "Company Creation - ⚠️ Missing Required Fields [ JSON Format ] ",
        {
          context: "createCompany",
          body: companyData,
        }
      );

      return res.status(422).json({
        status: "failure",
        message:
          "⚠️ Company code, company name, primary GST address, and email are required.",
      });
    }

    // Create the company document
    const company = await CompanyModel.create(companyData);
    // winstonLogger.info(`Company created successfully: ${company._id}`);

    // **** AUDIT LOG: "CREATE" ****
    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Company",
      action: "CREATE",
      recordId: company._id,
      changes: { newData: company }, // full doc or partial
    });

    // Invalidate the "all companies" cache key
    await redisClient.del("/fms/api/v0/companies");

    logger.info(
      "✅ Company Created Successfully and logged 🧾 in Audit Logs ",
      {
        context: "createCompany",
        companyId: company._id,
        timestamp: new Date().toISOString(),
      }
    );
    loggerJsonFormat.info(" ✅ Company Created Successfully [ JSON Format ] ", {
      context: "createCompany",
      companyId: company._id,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      status: "success",
      message: " ✅ Company created successfully.",
      data: company,
    });
  } catch (error) {
    // logError("Company Creation", error);
    // if (error.name === "ValidationError") {
    //   return res.status(422).json({
    //     status: "failure",
    //     message: "Validation error during company creation.",
    //     error: error.message,
    //   });
    // }

    // Handle specific error types
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Company Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "❌ Validation error during customer creation.",
        error: error.message,
      });
    }

    if (error.code === 11000) {
      logStackError(" ❌ Company Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "A company with this code number or email id  already exists.",
      });
    }

    if (error.message.includes("network error")) {
      logStackError("❌ Company Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logStackError("❌ Company Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message:
        "An unexpected error occurred. Please try again. It could be internal server error which is unknown ",
      error: error.message,
    });

    // return res.status(500).json({
    //   status: "failure",
    //   message: "Internal Server Error",
    //   error: error.message,
    // });
  }
};

export const createCompany = async (req, res) => {
  try {
    //const companyData = req.body;
    const {
      companyCode,
      companyName,
      email,
      primaryGSTAddress,
      globalPartyId,
      ...rest
    } = req.body;

    // Validate required fields
    if (!companyCode || !companyName || !primaryGSTAddress || !email) {
      logger.warn("Company Creation - ⚠️ Missing Required Fields", {
        context: "createCompany",
        body: { companyCode, companyName, email, primaryGSTAddress },
      });

      loggerJsonFormat.warn(
        "Company Creation - ⚠️ Missing Required Fields [ JSON Format ] ",
        {
          context: "createCompany",
          body: { companyCode, companyName, email, primaryGSTAddress },
        }
      );

      return res.status(422).json({
        status: "failure",
        message:
          "⚠️ Company code, company name, primary GST address, and email are required.",
      });
    }

    // 2) Prepare a variable to hold the final partyId
    let partyId = null;

    // 3) If no globalPartyId was passed, we create a new GlobalParty doc with partyType=["Customer"].
    if (!globalPartyId) {
      const newParty = await GlobalPartyModel.create({
        name: companyName, // or pass something else for .name
        partyType: ["Company"], // force the array to have "Customer"
      });
      partyId = newParty._id;
    } else {
      // 4) If globalPartyId is provided, we find that doc
      const existingParty = await GlobalPartyModel.findById(globalPartyId);
      if (!existingParty) {
        // Option A: Throw an error
        // return res.status(404).send({
        //   status: "failure",
        //   message: `GlobalParty with ID ${globalPartyId} does not exist.`,
        // });

        // Option B: Or create a new GlobalParty doc with that _id (rarely recommended)
        // But usually you'd want to fail if the globalPartyId doesn't exist
        return res.status(404).json({
          status: "failure",
          message: `⚠️ GlobalParty ${globalPartyId} not found. (Cannot create Company referencing missing party.)`,
        });
      }

      // 5) If found, ensure "Customer" is in the partyType array
      if (!existingParty.partyType.includes("Company")) {
        existingParty.partyType.push("Company");
        await existingParty.save();
      }

      // We'll use the existingParty's _id
      partyId = existingParty._id;
    }

    // Create the company document
    const company = await CompanyModel.create({
      companyCode,
      companyName,
      email,
      primaryGSTAddress,
      globalPartyId: partyId,
      ...rest,
    });
    // winstonLogger.info(`Company created successfully: ${company._id}`);

    // **** AUDIT LOG: "CREATE" ****
    await createAuditLog({
      user: req.user?.username || "67ec2fb004d3cc3237b58772",
      module: "Company",
      action: "CREATE",
      recordId: company._id,
      changes: { newData: company }, // full doc or partial
    });

    // Invalidate the "all companies" cache key
    await redisClient.del("/fms/api/v0/companies");

    logger.info(
      "✅ Company Created Successfully and logged 🧾 in Audit Logs ",
      {
        context: "createCompany",
        companyId: company._id,
        timestamp: new Date().toISOString(),
      }
    );
    loggerJsonFormat.info(" ✅ Company Created Successfully [ JSON Format ] ", {
      context: "createCompany",
      companyId: company._id,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      status: "success",
      message: " ✅ Company created successfully.",
      data: company,
    });
  } catch (error) {
    // logError("Company Creation", error);
    // if (error.name === "ValidationError") {
    //   return res.status(422).json({
    //     status: "failure",
    //     message: "Validation error during company creation.",
    //     error: error.message,
    //   });
    // }

    // Handle specific error types
    if (error instanceof mongoose.Error.ValidationError) {
      logStackError("❌ Company Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "❌ Validation error during customer creation.",
        error: error.message,
      });
    }

    if (error.code === 11000) {
      logStackError(" ❌ Company Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "A company with this code number or email id  already exists.",
      });
    }

    if (error.message.includes("network error")) {
      logStackError("❌ Company Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logStackError("❌ Company Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message:
        "An unexpected error occurred. Please try again. It could be internal server error which is unknown ",
      error: error.message,
    });

    // return res.status(500).json({
    //   status: "failure",
    //   message: "Internal Server Error",
    //   error: error.message,
    // });
  }
};

/**
 * Retrieve all Companies.
 */
export const getAllCompanies = async (req, res) => {
  try {
    const companies = await CompanyModel.find();

    // ADDED
    // 2) store it in Redis for subsequent requests
    // use the same key used in the cacheMiddleware
    const cacheKey = req.originalUrl; // e.g. "/fms/api/v0/companies"
    await redisClient.set(cacheKey, JSON.stringify(companies), {
      EX: 60 * 5, // expire in 5 minutes
    });

    dbgRedis("redis mounting complete ", redisClient);

    logger.info("✅ Fetched All Companies", {
      context: "getAllCompanies",
      count: companies.length,
    });
    loggerJsonFormat.info(" ✅ Fetched All Companies", {
      context: "getAllCompanies",
      count: companies.length,
    });
    //winstonLogger.info(`Retrieved ${companies.length} companies.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Companies retrieved successfully.",
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    logStackError("Get All Companies - ❌ Fetch Error ", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error while fetching the Companies",
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
        message: "⚠️ Company not found.",
      });
    }
    winstonLogger.info(`✅ Retrieved company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Company retrieved successfully.",
      data: company,
    });
  } catch (error) {
    logError("❌ Get Company By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error",
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
        message: "⚠️ Company not found.",
      });
    }
    winstonLogger.info(`ℹ️ Updated company: ${company._id}`);

    // await redisClient.del("/fms/api/v0/companies");

    return res.status(200).json({
      status: "success",
      message: "✅ Company updated successfully.",
      data: company,
    });
  } catch (error) {
    logError("❌ Update Company By ID", error);
    if (error.name === "ValidationError") {
      return res.status(422).json({
        status: "failure",
        message: "❌ Validation error during company update.",
        error: error.message,
      });
    }
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error",
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

    // await redisClient.del("/fms/api/v0/companies");

    if (!company) {
      return res.status(404).json({
        status: "failure",
        message: "⚠️ Company not found.",
      });
    }
    winstonLogger.info(`ℹ️ Deleted company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Company deleted successfully.",
    });
  } catch (error) {
    logError("❌ Delete Company By ID", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error",
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
        message: "⚠️ Company not found.",
      });
    }
    winstonLogger.info(`ℹ️ Archived company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Company archived successfully.",
      data: company,
    });
  } catch (error) {
    logError("❌ Archive Company", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error",
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
        message: "⚠️ Company not found.",
      });
    }
    winstonLogger.info(`ℹ️ Unarchived company: ${company._id}`);
    return res.status(200).json({
      status: "success",
      message: "✅ Company unarchived successfully.",
      data: company,
    });
  } catch (error) {
    logError("❌ Unarchive Company", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error",
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
    winstonLogger.info(`ℹ️ Retrieved ${companies.length} archived companies.`);
    return res.status(200).json({
      status: "success",
      message: "✅ Archived companies retrieved successfully.",
      data: companies,
    });
  } catch (error) {
    logError("❌ Get Archived Companies", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Internal Server Error",
      error: error.message,
    });
  }
};

// ──────── BULK OPERATIONS (ADDED) ──────────────────────────────────────────

/**
 * Bulk Create Companies.
 * Expects req.body = [{ companyCode, companyName, ... }, ...]
 */
export const bulkCreateCompanies = async (req, res) => {
  const docs = req.body;
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of company objects.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("💾 Bulk create: inserting companies", {
      context: "bulkCreateCompanies",
      count: docs.length,
    });

    // insertMany uses session for atomicity
    const created = await CompanyModel.insertMany(docs, { session });

    // Audit-log each creation
    await Promise.all(
      created.map((company) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Company",
          action: "BULK_CREATE",
          recordId: company._id,
          changes: { newData: company },
        })
      )
    );

    await session.commitTransaction();
    session.endSession();

    // invalidate cache
    await invalidateCompanyCache();

    logger.info("✅ Bulk create successful", {
      context: "bulkCreateCompanies",
      createdCount: created.length,
    });
    return res.status(201).json({
      status: "success",
      message: `✅ ${created.length} companies created successfully.`,
      data: created,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk create error", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Error during bulk company creation.",
      error: error.message,
    });
  }
};

/**
 * Bulk Update Companies.
 * Expects req.body = [{ id: "...", update: { ... } }, ...]
 */
export const bulkUpdateCompanies = async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must be a non-empty array of {id, update}.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🔄 Bulk update: processing companies", {
      context: "bulkUpdateCompanies",
      count: updates.length,
    });

    const results = [];
    for (const { id, update } of updates) {
      const updated = await CompanyModel.findByIdAndUpdate(
        id,
        { ...update, updatedBy: req.user?.username || "Unknown" },
        { new: true, runValidators: true, session }
      );
      if (!updated) {
        throw new Error(`Company not found: ${id}`);
      }
      // Audit log per update
      await createAuditLog({
        user: req.user?.username || "67ec2fb004d3cc3237b58772",
        module: "Company",
        action: "BULK_UPDATE",
        recordId: updated._id,
        changes: { newData: updated },
      });
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateCompanyCache();

    logger.info("✅ Bulk update successful", {
      context: "bulkUpdateCompanies",
      updatedCount: results.length,
    });
    return res.status(200).json({
      status: "success",
      message: `✅ ${results.length} companies updated successfully.`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk update error", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Error during bulk company update.",
      error: error.message,
    });
  }
};

/**
 * Bulk Delete Companies.
 * Expects req.body = { ids: ["...", "...", ...] }
 */
export const bulkDeleteCompanies = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "⚠️ Request body must include a non-empty array of ids.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    logger.info("🗑️ Bulk delete: removing companies", {
      context: "bulkDeleteCompanies",
      count: ids.length,
    });

    const { deletedCount } = await CompanyModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (deletedCount === 0) {
      throw new Error("No companies deleted (ids may be invalid).");
    }

    // Audit-log each deletion
    await Promise.all(
      ids.map((id) =>
        createAuditLog({
          user: req.user?.username || "67ec2fb004d3cc3237b58772",
          module: "Company",
          action: "BULK_DELETE",
          recordId: id,
          changes: null,
        })
      )
    );

    await session.commitTransaction();
    session.endSession();
    await invalidateCompanyCache();

    logger.info("✅ Bulk delete successful", {
      context: "bulkDeleteCompanies",
      deletedCount,
    });
    return res.status(200).json({
      status: "success",
      message: `✅ ${deletedCount} companies deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logStackError("❌ Bulk delete error", error);
    return res.status(500).json({
      status: "failure",
      message: "❌ Error during bulk company deletion.",
      error: error.message,
    });
  }
};
