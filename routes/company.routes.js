// routes/1_0_0/company.routes.js

import express from "express";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompanyById,
  deleteCompanyById,
  archiveCompanyById,
  unarchiveCompanyById,
  getArchivedCompanies,
} from "../controllers/company.controller.js";
import { cacheMiddleware } from "../middleware/cacheMiddleware.js";

const companyRouter = express.Router();

// Example: GET all companies, use cacheMiddleware
// 1) cacheMiddleware checks if data is already in Redis
// 2) If found, returns immediately
// 3) If not found, calls getAllCompanies

companyRouter.post("/", createCompany);
companyRouter.get("/archived", getArchivedCompanies); // Must be defined before :companyId route
companyRouter.get("/", cacheMiddleware, getAllCompanies); // ADDED
// companyRouter.get("/", getAllCompanies); // ADDED
companyRouter.get("/:companyId", getCompanyById);
companyRouter.put("/:companyId", updateCompanyById);
companyRouter.delete("/:companyId", deleteCompanyById);
companyRouter.patch("/:companyId/archive", archiveCompanyById);
companyRouter.patch("/:companyId/unarchive", unarchiveCompanyById);

export { companyRouter };
