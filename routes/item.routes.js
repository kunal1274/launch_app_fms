import {
  bulkCreateItems,
  bulkDeleteItems,
  bulkUpdateItems,
  createItem,
  deleteAllItems,
  deleteItem,
  getItem,
  getItems,
  getMetadataItems,
  searchItems,
  updateItem,
  uploadFilesAgainstItem,
} from "../controllers/item.controller.js";
import expressItem from "express";
import { upload } from "../middleware/uploadConfig.js";

const itemRouter = expressItem.Router();

// Metadata endpoints
itemRouter.get("/metadata", getMetadataItems);
itemRouter.get("/:itemId/metadata", getMetadataItems);

// Core CRUD operations
itemRouter.post("/", createItem);
itemRouter.get("/", getItems);
itemRouter.get("/:itemId", getItem);
itemRouter.put("/:itemId", updateItem);
itemRouter.delete("/:itemId", deleteItem);
itemRouter.delete("/", deleteAllItems);

// Search and filtering
itemRouter.get("/search", searchItems);

// Bulk operations
itemRouter.post("/bulk", bulkCreateItems);
itemRouter.put("/bulk", bulkUpdateItems);
itemRouter.delete("/bulk", bulkDeleteItems);

// File operations
itemRouter.post(
  "/:itemId/upload",
  upload.array("files", 10),
  uploadFilesAgainstItem
);

export { itemRouter };
