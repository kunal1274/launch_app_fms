import express from "express";
import {
  attachGroupToCustomer,
  createCustomer,
  deleteAllCustomers,
  deleteCustomer,
  getCustomer,
  getCustomers,
  updateCustomer,
} from "../controllers/customer.controller.js";

const customerRouter = express.Router();

customerRouter.post("/", createCustomer);
customerRouter.get("/", getCustomers);
customerRouter.get("/:customerId", getCustomer);
customerRouter.put("/:customerId", updateCustomer);
customerRouter.delete("/:customerId", deleteCustomer);
customerRouter.delete("/", deleteAllCustomers);
customerRouter.post("/attach-groups", attachGroupToCustomer);

// // We want both the action-level check for "READ_CUSTOMER"
// // AND the data-level scoping for "CUSTOMER"
// router.get(
//   "/",
//   authenticateUser,
//   checkPermissions(["READ_CUSTOMER"]),
//   applyDataScope("CUSTOMER"),
//   getCustomers
// );

export { customerRouter };
