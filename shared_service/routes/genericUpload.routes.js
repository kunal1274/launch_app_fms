// routes/upload.routes.js
import express from "express";
import { upload } from "../../middleware/uploadConfig.js";
import {
  deleteUploadedFile,
  uploadFiles,
} from "../controllers/genericUpload.controller.js";

export const genericUploadRouter = express.Router();

genericUploadRouter.post(
  "/:entity/:entityId",
  upload.array("files", 10),
  uploadFiles
);

// ── New DELETE endpoint ───────────────────────────────
genericUploadRouter.delete(
  "/:entity/:entityId/files/:fileId",
  deleteUploadedFile
);
