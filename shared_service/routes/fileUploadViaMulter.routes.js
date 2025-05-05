// routes/upload.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { uploadMulter } from "../../middleware/uploadMulterConfig.js";
import * as ctrl from "../controllers/fileUpload.controller.js";
import { SalesOrderModel } from "../../bb3_sales_management_service/models/bb3SalesOrder.model.js";

export const fileRouter = express.Router();

// fileRouter
//   .post("/:id/files-upload", uploadMulter.array("files", 10), ctrl.saveFiles)
//   .get("/:id/files-upload", ctrl.listFiles)
//   .delete("/:id/files-upload/:fileId", ctrl.deleteFile);

// 4) Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    // const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // cb(null, unique + path.extname(file.originalname));
    const now = new Date();
    const readableDate = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toTimeString().split(" ")[0].replace(/:/g, "");
    //const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const uniqueSuffix = `${readableDate}-${time}-${Math.round(
      Math.random() * 1e9
    )}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

/**
 * POST   /api/sales-orders/:id/upload-files
 * - upload.array('files')
 * - pushes new file docs into salesOrder.attachedFiles
 */
fileRouter.post(
  "/:id/upload-files",
  upload.array("files", 10),
  async (req, res) => {
    try {
      const soId = req.params.id;
      // build the subdocs to push
      const docs = req.files.map((f) => ({
        _id: new mongoose.Types.ObjectId(), // ensure each subdoc has its own _id
        fileName: f.filename,
        fileOriginalName: f.originalname,
        fileUrl: `/uploads/${f.filename}`,
        fileType: f.mimetype,
        fileUploadedAt: new Date(),
      }));

      const updated = await SalesOrderModel.findByIdAndUpdate(
        soId,
        { $push: { attachedFiles: { $each: docs } } },
        { new: true, runValidators: true }
      ).select("attachedFiles");

      if (!updated) {
        // rollback disk writes if desired…
        return res
          .status(404)
          .json({ status: "failure", message: "Sales-order not found" });
      }

      res.status(201).json({
        status: "success",
        files: updated.attachedFiles.slice(-docs.length),
      });
    } catch (err) {
      console.error("💥 upload-to-SO error:", err);
      res.status(500).json({
        status: "failure",
        message: err.message || "Could not attach files to Sales-order",
      });
    }
  }
);

/**
 * GET    /api/sales-orders/:id/files
 * - returns the array of attachedFiles
 */
fileRouter.get("/:id/files", async (req, res) => {
  try {
    const so = await SalesOrderModel.findById(req.params.id).select(
      "attachedFiles"
    );
    if (!so)
      return res.status(404).json({ status: "failure", message: "Not found" });
    res.json({ status: "success", files: so.attachedFiles });
  } catch (err) {
    console.error("💥 get-SO-files error:", err);
    res.status(500).json({ status: "failure", message: err.message });
  }
});

/**
 * DELETE /api/sales-orders/:id/files/:fileId
 * - removes the subdoc and deletes the file from disk
 */
// app.delete("/api/sales-orders/:id/files/:fileId", async (req, res) => {
//   try {
//     const { id: soId, fileId } = req.params;
//     const so = await SalesOrderModel.findById(soId);
//     if (!so)
//       return res
//         .status(404)
//         .json({ status: "failure", message: "Sales-order not found" });

//     const fileDoc = so.attachedFiles.id(fileId);
//     if (!fileDoc)
//       return res
//         .status(404)
//         .json({ status: "failure", message: "File not found" });

//     // remove from array
//     fileDoc.remove();
//     await so.save();

//     // delete from disk
//     const diskPath = path.join(process.cwd(), "uploads", fileDoc.filename);
//     fs.unlink(diskPath, (unlinkErr) => {
//       if (unlinkErr)
//         console.warn("⚠️ could not delete file from disk:", unlinkErr);
//     });

//     res.sendStatus(204);
//   } catch (err) {
//     console.error("💥 delete-SO-file error:", err);
//     res.status(500).json({ status: "failure", message: err.message });
//   }
// });

// DELETE /api/sales-orders/:id/files/:fileId

fileRouter.delete("/:id/files/:fileId", async (req, res) => {
  try {
    const { id: soId, fileId } = req.params;
    // 1) Load the sales-order
    const so = await SalesOrderModel.findById(soId);
    if (!so) {
      return res
        .status(404)
        .json({ status: "failure", message: "Sales-order not found" });
    }

    // 2) Find the file subdoc
    const fileSubdoc = so.attachedFiles.find(
      (f) => f._id.toString() === fileId
    );
    if (!fileSubdoc) {
      return res
        .status(404)
        .json({ status: "failure", message: "File not found on this SO" });
    }

    // 3) Remember the filename so we can unlink later
    //const { filename } = fileSubdoc;
    const { fileName } = fileSubdoc;

    // 4) Remove it from the array
    //    A) in-memory filter:
    so.attachedFiles = so.attachedFiles.filter(
      (f) => f._id.toString() !== fileId
    );

    //    (or you could use Mongoose’s pull operator:
    //     await SalesOrderModel.updateOne(
    //       { _id: soId },
    //       { $pull: { attachedFiles: { _id: fileId } } }
    //     ); )

    // 5) Save the parent doc
    await so.save();

    // 6) Delete from disk
    //const diskPath = path.join(process.cwd(), "uploads", filename);
    const diskPath = path.join(process.cwd(), "uploads", fileName);
    fs.unlink(diskPath, (err) => {
      if (err) console.warn("Could not remove file from disk:", err);
    });

    return res.sendStatus(204);
  } catch (err) {
    console.error("Delete SO-file error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
});
