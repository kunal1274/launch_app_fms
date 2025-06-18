import {
  createItem,
  deleteAllItems,
  deleteItem,
  getItem,
  getItems,
  getMetadataItems,
  updateItem,
  uploadFilesAgainstItem,
} from "../controllers/item.controller.js";
import expressItem from "express";
import { upload } from "../middleware/uploadConfig.js";

const itemRouter = expressItem.Router();

// New batch metadata endpoint
itemRouter.get("/metadata", getMetadataItems);

itemRouter.post("/", createItem);
itemRouter.get("/", getItems);
itemRouter.get("/:itemId/metadata", getMetadataItems);
itemRouter.get("/:itemId", getItem);
itemRouter.put("/:itemId", updateItem);
itemRouter.delete("/:itemId", deleteItem);
itemRouter.delete("/", deleteAllItems);
// Upload files for an item
itemRouter.post(
  "/:itemId/upload",
  upload.array("files", 10),
  uploadFilesAgainstItem
);

export { itemRouter };
