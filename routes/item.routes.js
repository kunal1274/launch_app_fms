import {
  createItem,
  deleteAllItems,
  deleteItem,
  getItem,
  getItems,
  updateItem,
  uploadFilesAgainstItem,
} from "../controllers/item.controller.js";
import expressItem from "express";
//   import { upload } from "../../middleware/1_0_0/uploadConfig.1_0_0.mw.js";

const itemRouter = expressItem.Router();

itemRouter.post("/", createItem);
itemRouter.get("/", getItems);
itemRouter.get("/:itemId", getItem);
itemRouter.put("/:itemId", updateItem);
itemRouter.delete("/:itemId", deleteItem);
itemRouter.delete("/", deleteAllItems);
// Upload files for an item
//   itemRouter.post(
//     "/:itemId/upload",
//     upload.array("files", 10),
//     uploadFilesAgainstItem
//   );

export { itemRouter };
