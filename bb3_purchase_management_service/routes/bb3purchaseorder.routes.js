// import expressPO from "express";
// // import { upload } from "../middleware/uploadConfig.muuSHakaH.mw.js";
// import {
//   patchPurchaseOrderById,
//   createPurchaseOrder,
//   deleteAllPurchaseOrders,
//   deleteDraftPurchaseOrders,
//   deletePurchaseOrderById,
//   getAllPurchaseOrders,
//   getPurchaseOrderById,
//   updatePurchaseOrderById,
//   archivePurchaseOrderById,
//   unarchivePurchaseOrderById,
//   getArchivedPurchaseOrders,
//   changePurchaseOrderStatus,
//   addPayment,
//   generateInvoiceForOrder,
// } from "../controllers/

// const purchaseOrderRouter = expressPO.Router();

// purchaseOrderRouter.post("/", createPurchaseOrder);
// purchaseOrderRouter.get("/", getAllPurchaseOrders); // retrieve all purchase orders
// purchaseOrderRouter.get("/archived", getArchivedPurchaseOrders); // Retrieve only archived purchase orders.
// purchaseOrderRouter.get("/:purchaseOrderId", getPurchaseOrderById);
// purchaseOrderRouter.put("/:purchaseOrderId", updatePurchaseOrderById);
// purchaseOrderRouter.delete("/bulk-delete", deleteAllPurchaseOrders);
// purchaseOrderRouter.delete("/:purchaseOrderId", deletePurchaseOrderById);
// purchaseOrderRouter.delete("/drafts", deleteDraftPurchaseOrders);
// purchaseOrderRouter.patch("/:purchaseOrderId", patchPurchaseOrderById);
// purchaseOrderRouter.patch(
//   "/:purchaseOrderId/archive",
//   archivePurchaseOrderById
// );
// purchaseOrderRouter.patch(
//   "/:purchaseOrderId/unarchive",
//   unarchivePurchaseOrderById
// );
// purchaseOrderRouter.patch(
//   "/:purchaseOrderId/status",
//   changePurchaseOrderStatus
// );
// // Add a payment to a Purchase Order
// purchaseOrderRouter.post("/:purchaseOrderId/payment", addPayment);

// // New endpoint to generate an invoice number
// purchaseOrderRouter.patch(
//   "/:purchaseOrderId/generate-invoice",
//   generateInvoiceForOrder
// );

// // // Upload files for an item
// // itemRouter.post(
// //   "/:purchaseOrderId/upload",
// //   upload.array("files", 10),
// //   uploadFilesAgainstItem
// // );

// export { purchaseOrderRouter };
