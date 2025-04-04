// routes/permission.routes.js
import express from "express";
import {
  createPermission,
  getAllPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
  bulkCreatePermissions,
  bulkUpdatePermissions,
  bulkDeletePermissions,
  bulkOperationsPartial,
} from "../controllers/permission.controller.js";

const permissionRouter = express.Router();

permissionRouter.post("/", createPermission);
permissionRouter.get("/", getAllPermissions);
permissionRouter.get("/:id", getPermissionById);
permissionRouter.patch("/:id", updatePermission);
permissionRouter.delete("/:id", deletePermission);

// Additional
permissionRouter.post("/bulk", bulkCreatePermissions);
permissionRouter.patch("/bulk", bulkUpdatePermissions);
permissionRouter.delete("/bulk", bulkDeletePermissions);

// The new partial-ops route
permissionRouter.post("/bulk-ops-partial", bulkOperationsPartial);

export default permissionRouter;

/**
 [
  {
    "action": "create",
    "data": {
      "key": "TEST_CREATE",
      "module": "TEST_MODULE",
      "description": "testing partial create"
    }
  },
  {
    "action": "update",
    "data": {
      "_id": "64fe51206c2bf9bfe4c331f5",
      "description": "Updated partial success"
    }
  },
  {
    "action": "delete",
    "data": {
      "_id": "64fe51206c2bf9bfe4c331f7"
    }
  }
]

and response looks ..
{
  "message": "Bulk operations processed with partial success approach.",
  "results": [
    {
      "index": 0,
      "action": "create",
      "success": true,
      "dataOrError": {
        "_id": "6500a1b9e037f2de12bc5611",
        "key": "TEST_CREATE",
        "description": "testing partial create",
        "module": "TEST_MODULE",
        "area": "Common",
        "__v": 0
      }
    },
    {
      "index": 1,
      "action": "update",
      "success": false,
      "dataOrError": "Permission with _id=64fe51206c2bf9bfe4c331f5 not found."
    },
    {
      "index": 2,
      "action": "delete",
      "success": true,
      "dataOrError": {
        "message": "Permission deleted successfully",
        "_id": "64fe51206c2bf9bfe4c331f7"
      }
    }
  ]
}

  
 */
