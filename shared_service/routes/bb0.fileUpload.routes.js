// routes/upload.routes.js
import express from "express";
import { uploadMulter } from "../../middleware/uploadMulterConfig.js";
import * as ctrl from "../controllers/bb0.fileUpload.controller.js";

export const fileRouter = express.Router();

fileRouter
  .post("/:id/files-upload", uploadMulter.array("files", 10), ctrl.saveFiles)
  .get("/:id/files-upload", ctrl.listFiles)
  .delete("/:id/files-upload/:fileId", ctrl.deleteFile);
