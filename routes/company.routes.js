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

const companyRouter = express.Router();

companyRouter.post("/", createCompany);
companyRouter.get("/archived", getArchivedCompanies); // Must be defined before :companyId route
companyRouter.get("/", getAllCompanies);
companyRouter.get("/:companyId", getCompanyById);
companyRouter.put("/:companyId", updateCompanyById);
companyRouter.delete("/:companyId", deleteCompanyById);
companyRouter.patch("/:companyId/archive", archiveCompanyById);
companyRouter.patch("/:companyId/unarchive", unarchiveCompanyById);

export { companyRouter };
