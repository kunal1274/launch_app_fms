import express from "express";
import {
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

export { customerRouter };
