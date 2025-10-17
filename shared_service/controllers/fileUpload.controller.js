// controllers/file.controller.js
import fs from "fs";
import path from "path";
import { SalesOrderModel } from "../../bb3_sales_management_service/models/bb3SalesOrder.model.js";

const buildMeta = (f) => ({
  fileName: f.filename,
  fileOriginalName: f.originalname,
  fileType: f.mimetype,
  // fileUrl: `/uploads/sales-orders/${f.filename}`,
  fileUrl: `/uploads/${f.filename}`,
  fileUploadedAt: new Date(),
});

export const saveFiles = async (req, res, next) => {
  try {
    const metas = req.files.map(buildMeta);
    const so = await SalesOrderModel.findByIdAndUpdate(
      req.params.id,
      { $push: { files: { $each: metas } } },
      { new: true, select: "files" }
    );
    res.json(so.files);
  } catch (e) {
    next(e);
  }
};

export const listFiles = async (req, res, next) => {
  try {
    const so = await SalesOrderModel.findById(req.params.id).select("files");
    if (!so) return res.status(404).send("Sales order not found");
    res.json(so.files);
  } catch (e) {
    next(e);
  }
};

export const deleteFile = async (req, res, next) => {
  try {
    const { id: fileId, id: soId } = { ...req.params, id: req.params.id };

    const so = await SalesOrderModel.findById(soId).select("files");
    if (!so) return res.status(404).send("Sales order not found");

    const f = so.files.id(req.params.fileId);
    if (!f) return res.status(404).send("File not found");

    // fs.unlinkSync(
    //   path.join(process.cwd(), "uploads", "sales-orders", f.fileName)
    // );
    fs.unlinkSync(path.join(process.cwd(), "uploads", f.fileName));
    f.remove();
    await so.save();
    res.json(so.files);
  } catch (e) {
    next(e);
  }
};
