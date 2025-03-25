// import { SalesOrderModel } from "../models/salesorders.muuSHakaH.model.js";
import mongoose from "mongoose";
import { SalesOrderModel } from "../models/salesorder.model.js";
import { SalesOrderCounterModel } from "../models/counter.model.js";
import { ItemModel } from "../models/item.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { logError } from "../utility/logError.utils.js";

/**
 * Helper function to validate status transitions
 * @param {String} currentStatus
 * @param {String} newStatus
 * @returns {Boolean}
 */
const isValidStatusTransition = (currentStatus, newStatus) => {
  const STATUS_TRANSITIONS = {
    Draft: ["Confirmed", "Cancelled", "AdminMode", "AnyMode"],
    Confirmed: ["Shipped", "Cancelled", "AdminMode", "AnyMode"],
    Shipped: ["Delivered", "Cancelled", "AdminMode", "AnyMode"],
    Delivered: ["Invoiced", "AdminMode", "AnyMode"],
    Invoiced: ["AdminMode", "AnyMode"],
    Cancelled: ["AdminMode", "AnyMode"],
    AdminMode: ["Draft", "AnyMode"],
    AnyMode: [
      "Draft",
      "Confirmed",
      "Shipped",
      "Delivered",
      "Invoiced",
      "Cancelled",
      "AdminMode",
    ],
  };

  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus);
};

// Helper function to generate an invoice number (same as your existing implementation)
async function generateInvoiceNumber() {
  const counter = await SalesOrderCounterModel.findByIdAndUpdate(
    { _id: "invoiceNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seqNumber = counter.seq.toString().padStart(6, "0");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let financialYear;
  if (month >= 4) {
    financialYear = `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    financialYear = `${year - 1}-${year.toString().slice(-2)}`;
  }
  const monthPrefix = now.toLocaleString("en-US", { month: "short" });
  const companyPrefix = process.env.COMPANY_PREFIX || "DEF";
  return `${companyPrefix}/${financialYear}/${monthPrefix}/INV-${seqNumber}`;
}

export const createSalesOrder = async (req, res) => {
  const salesOrderBody = req.body;

  try {
    // Check for required fields
    if (!salesOrderBody.customer || !salesOrderBody.item) {
      return res.status(422).send({
        status: "failure",
        message: "Customer and Item are required fields.",
      });
    }

    // Validate existence of the customer
    const customerExists = await CustomerModel.findById(
      salesOrderBody.customer
    );
    if (!customerExists) {
      return res.status(404).send({
        status: "failure",
        message: `Customer with ID ${salesOrderBody.customer} does not exist.`,
      });
    }

    // Validate existence of the item
    const itemExists = await ItemModel.findById(salesOrderBody.item);
    if (!itemExists) {
      return res.status(404).send({
        status: "failure",
        message: `Item with ID ${salesOrderBody.item} does not exist.`,
      });
    }

    // Create Sales Order
    const dbResponseNewSalesOrder = await SalesOrderModel.create(
      salesOrderBody
    );

    console.log(
      `Sales order has been created successfully with id: ${
        dbResponseNewSalesOrder._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`
    );

    return res.status(201).send({
      status: "success",
      message: `Sales order has been created successfully with id: ${
        dbResponseNewSalesOrder._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`,
      data: dbResponseNewSalesOrder,
    });
  } catch (error) {
    // Database Validation Error
    if (error instanceof mongoose.Error.ValidationError) {
      logError("Sales Order Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "Validation error during sales order creation.",
        error: error.message || error,
      });
    }

    // MongoDB Duplicate Key Error
    if (error.code === 11000) {
      logError("Sales Order Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "A sales order with the same order number already exists.",
      });
    }

    // Handle MongoDB connection or network issues
    if (error.message.includes("network error")) {
      logError("Sales Order Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logError("Sales Order Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message: "An unexpected error occurred. Please try again.",
      error: error.message || error,
    });
  }
};

export const getSalesOrderById = async (req, res) => {
  const { salesOrderId } = req.params;

  try {
    // Use populate to fetch customer and item details
    const salesOrder = await SalesOrderModel.findById(salesOrderId)
      .populate("customer", "name contactNum address")
      .populate("item", "name description price type unit");

    if (!salesOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Sales order with ID ${salesOrderId} not found.`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Sales order retrieved successfully.",
      data: salesOrder,
    });
  } catch (error) {
    logError("Get Sales Order By ID", error);
    return res.status(500).send({
      status: "failure",
      message: `Error retrieving sales order with ID ${salesOrderId}.`,
      error: error.message,
    });
  }
};

export const getAllSalesOrders = async (req, res) => {
  const { archived } = req.query; // Check if archived filter is passed
  const filter = { archived: false };
  if (archived === "false") filter = {};
  if (archived === "true") filter.archived = true;
  //if (archived === "false") filter.archived = false;
  try {
    // Retrieve all sales orders with customer and item details populated
    const salesOrders = await SalesOrderModel.find(filter)
      .populate("customer", "name contactNum address")
      .populate(
        "item",
        "name description price purchPrice salesPrice invPrice type unit"
      );

    if (!salesOrders || salesOrders.length === 0) {
      return res.status(404).send({
        status: "failure",
        message: "No sales orders found.",
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Sales orders retrieved successfully.",
      count: salesOrders.length,
      user: req.user?.email,
      data: salesOrders,
    });
  } catch (error) {
    logError("Get All Sales Orders", error);
    return res.status(500).send({
      status: "failure",
      message: "Error retrieving sales orders.",
      error: error.message,
    });
  }
};

export const updateSalesOrderById = async (req, res) => {
  const { salesOrderId } = req.params;
  const updatedData = req.body;

  try {
    // Check for required fields
    if (!updatedData.customer || !updatedData.item) {
      return res.status(422).send({
        status: "failure",
        message: "Customer and Item are required fields.",
      });
    }

    const updatedSalesOrder = await SalesOrderModel.findByIdAndUpdate(
      salesOrderId,
      updatedData,
      { new: true, runValidators: true }
    )
      .populate("customer", "name contactNum address")
      .populate("item", "name description price type unit");

    if (!updatedSalesOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Sales order with ID ${salesOrderId} not found.`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Sales order updated successfully.",
      data: updatedSalesOrder,
    });
  } catch (error) {
    logError("Update Sales Order By ID", error);

    // Validation Error Handling
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(422).send({
        status: "failure",
        message: "Validation error during sales order update.",
        error: error.message,
      });
    }

    return res.status(500).send({
      status: "failure",
      message: `Error updating sales order with ID ${salesOrderId}.`,
      error: error.message,
    });
  }
};

export const archiveSalesOrderById = async (req, res) => {
  const { salesOrderId } = req.params;
  try {
    const updatedOrder = await SalesOrderModel.findByIdAndUpdate(
      salesOrderId,
      { archived: true },
      { new: true } // Return the updated document
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Error archiving sales order", error });
  }
};

export const unarchiveSalesOrderById = async (req, res) => {
  const { salesOrderId } = req.params;
  try {
    const updatedOrder = await SalesOrderModel.findByIdAndUpdate(
      salesOrderId,
      { archived: false },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Error unarchiving sales order", error });
  }
};

export const getArchivedSalesOrders = async (req, res) => {
  try {
    const archivedOrders = await SalesOrderModel.find({ archived: true });
    if (!archivedOrders) {
      return res.status(404).send({
        status: "failure",
        message:
          "No Archived sales order found or failed to retrieve the archived SO",
        count: 0,
        data: [],
      });
    }
    return res.status(200).send({
      status: "success",
      message: "Archived Sales order are fetched successfully.",
      count: archivedOrders.length,
      data: archivedOrders,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching archived sales orders", error });
  }
};

export const deleteSalesOrderById = async (req, res) => {
  const { salesOrderId } = req.params;
  if (!salesOrderId) {
    return res.status(422).send({
      status: "failure",
      message: `The request parameter or body can't be blank`,
    });
  }

  try {
    //const salesOrder = await SalesOrderModel.findById(salesOrderId);
    // if (salesOrder.status !== "Draft") {
    //   return res.status(400).send({
    //     status: "failure",
    //     message: `The sales order with other than Draft status can't be deleted`,
    //   });
    // }
    const deletedSalesOrder = await SalesOrderModel.findByIdAndDelete(
      salesOrderId
    );

    if (!deletedSalesOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Sales order with ID ${salesOrderId} not found.`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: `Sales order with ID ${salesOrderId} deleted successfully.`,
      data: deletedSalesOrder,
    });
  } catch (error) {
    logError("Delete Sales Order By ID", error);
    return res.status(500).send({
      status: "failure",
      message: `Error deleting sales order with ID ${salesOrderId}.`,
      error: error.message,
    });
  }
};

export const deleteAllSalesOrders = async (req, res) => {
  try {
    console.log("Starting bulk delete...");

    // Delete all sales orders
    const deletedResponse = await SalesOrderModel.deleteMany({});
    console.log("Deleted Response:", deletedResponse);

    // Reset the counter
    const resetCounter = await SalesOrderCounterModel.findOneAndUpdate(
      { _id: "salesOrderCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );
    console.log("Counter Reset Response:", resetCounter);

    if (deletedResponse.deletedCount === 0) {
      return res.status(200).send({
        status: "success",
        message: "No sales orders to delete.",
        data: { deletedCount: 0 },
      });
    }

    return res.status(200).send({
      status: "success",
      message: `${deletedResponse.deletedCount} sales orders deleted successfully.`,
      data: {
        deletedCount: deletedResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    console.error("Error deleting sales orders:", error);
    return res.status(500).send({
      status: "failure",
      message: "Error deleting all sales orders.",
      error: error.message,
    });
  }
};

/**
 * Add a payment to a Sales Order.
 * Expected JSON body:
 *   {
 *     amount: Number,
 *     transactionId: String,
 *     paymentMode: String,
 *     date: Date (optional)
 *   }
 * Business rules:
 *   - If the order's status is not "Invoiced", the payment is considered as an advance.
 *     In that case, the advance field is increased by the payment amount.
 *   - In all cases, the payment object is added to the paidAmt array.
 *   - Settlement status is updated based on (advance + totalPaid) vs. netAR.
 */
export const addPayment = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const { amount, transactionId, paymentMode, date } = req.body;
    // if (!amount || amount <= 0) {
    //   return res
    //     .status(400)
    //     .json({ error: "A positive payment amount is required." });
    // }
    if (!amount) {
      return res.status(400).json({ error: "A payment amount is required." });
    }
    // Retrieve the sales order
    const order = await SalesOrderModel.findById(salesOrderId);
    if (!order) {
      return res.status(404).json({ error: "Sales Order not found." });
    }
    // // If order.status is not "Invoiced", treat payment as advance
    // if (order.status !== "Invoiced") {
    //   order.advance = Math.round((order.advance + amount) * 100) / 100;
    // }
    // Append the new payment object to paidAmt array
    order.paidAmt.push({
      amount,
      transactionId,
      paymentMode,
      date: date || Date.now(),
    });
    // Update settlement status (using the document method)
    order.updateSettlementStatus();
    // Recalculate netAmountAfterAdvance = netAR - (advance + totalPaid)
    const totalPaid = order.totalPaid;
    order.netPaymentDue =
      Math.round((order.netAR - (order.advance + totalPaid)) * 100) / 100;
    await order.save();
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Change the status of a Sales Order
 */
export const changeSalesOrderStatus = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const { newStatus, invoiceDate, dueDate } = req.body; // optionally provided

    if (!newStatus) {
      return res.status(400).json({ error: "New status is required" });
    }

    const order = await SalesOrderModel.findById(salesOrderId);
    if (!order) {
      return res.status(404).json({ error: "Sales Order not found" });
    }

    // Validate status transition
    if (!isValidStatusTransition(order.status, newStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${order.status} to ${newStatus}`,
      });
    }

    if (newStatus === "Invoiced") {
      // Generate a new invoice number
      const newInvoiceNum = await generateInvoiceNumber();

      // Optionally, update the status to "Invoiced" if desired:
      //order.status = "Invoiced";
      order.invoiceNum = newInvoiceNum;
      // If newStatus is "Invoiced", ensure invoiceDate and dueDate are set.
      // (Even though the hooks also set defaults, you can pass these in from the request.)

      // If invoiceDate is not provided, default to current date.
      if (!invoiceDate) {
        order.invoiceDate = new Date();
      } else {
        order.invoiceDate = new Date(invoiceDate);
      }
      // If dueDate is not provided, default to 30 days after invoiceDate.
      if (!dueDate) {
        const tempDate = new Date(order.invoiceDate);
        tempDate.setDate(tempDate.getDate() + 30);
        order.dueDate = tempDate;
      } else {
        order.dueDate = new Date(dueDate);
      }
      // The invoiceNum will be generated in the pre-save hook (or pre-findOneAndUpdate) if missing.
    }

    // Update status
    order.status = newStatus;
    // Optionally update 'updatedBy' field
    order.updatedBy = req.user?.username || "Unknown"; // Assuming you have user info in req
    await order.save();

    res.status(200).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to generate an invoice number for a given Sales Order.
 * This endpoint updates the invoiceNum field (and optionally sets status to "Invoiced")
 * and returns the updated order.
 */
export const generateInvoiceForOrder = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const order = await SalesOrderModel.findById(salesOrderId);
    if (!order) {
      return res
        .status(404)
        .json({ status: "failure", message: "Sales Order not found." });
    }

    // Generate a new invoice number
    const newInvoiceNum = await generateInvoiceNumber();

    // Optionally, update the status to "Invoiced" if desired:
    //order.status = "Invoiced";
    order.invoiceNum = newInvoiceNum;

    // Save the updated order
    await order.save();

    return res.status(200).json({
      status: "success",
      message: "Invoice generated successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    return res.status(500).json({
      status: "failure",
      message: "Failed to generate invoice.",
      error: error.message || error,
    });
  }
};

export const deleteDraftSalesOrders = async (req, res) => {
  try {
    // Restrict deletion to only 'Draft' sales orders
    const deletedResponse = await SalesOrderModel.deleteMany({
      status: "Draft",
    });

    if (deletedResponse.deletedCount === 0) {
      return res.status(404).send({
        status: "failure",
        message: "No draft sales orders found to delete.",
      });
    }

    return res.status(200).send({
      status: "success",
      message: `Successfully deleted ${deletedResponse.deletedCount} draft sales order(s).`,
    });
  } catch (error) {
    console.error("Error deleting draft sales orders:", error);
    return res.status(500).send({
      status: "failure",
      message: "Error deleting draft sales orders.",
      error: error.message,
    });
  }
};

export const patchSalesOrderById = async (req, res) => {
  const { salesOrderId } = req.params;
  const patchedData = req.body;

  try {
    const salesOrder = await SalesOrderModel.findById(salesOrderId);

    if (!salesOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Sales order with ID ${salesOrderId} not found.`,
      });
    }

    // Track changes for audit
    const changes = [];
    const changedBy = req.user?.name || "AdminUIPatch"; // Default to admin if no user info is available

    // If status is being updated, handle it separately
    if (patchedData.status && salesOrder.status !== patchedData.status) {
      await validateSalesOrderStatus(
        salesOrder,
        patchedData.status,
        changedBy,
        patchedData.reason || "No Reason Provided"
      );

      changes.push({
        field: "status",
        oldValue: salesOrder.status,
        newValue: patchedData.status,
      });
      salesOrder.status = patchedData.status;
    }

    // Update other fields
    const allowedFields = ["customer", "item", "quantity", "price"];
    for (const field of allowedFields) {
      if (patchedData[field] && salesOrder[field] !== patchedData[field]) {
        changes.push({
          field,
          oldValue: salesOrder[field],
          newValue: patchedData[field],
        });
        salesOrder[field] = patchedData[field];
      }
    }

    // Save changes
    const updatedSalesOrder = await salesOrder.save();

    // Log changes to history (audit tracking)
    if (changes.length > 0) {
      const logEntries = changes.map((change) => ({
        salesOrderId,
        changedBy,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason: patchedData.reason || "No Reason Provided",
        timestamp: new Date(),
      }));
      await SalesOrderEventLogModel.insertMany(logEntries);
    }

    return res.status(200).send({
      status: "success",
      message: "Sales order updated successfully.",
      data: updatedSalesOrder,
    });
  } catch (error) {
    console.error("Error updating sales order:", error);
    return res.status(500).send({
      status: "failure",
      message: "Error updating sales order.",
      error: error.message,
    });
  }
};

export const validateSalesOrderStatus = async (
  salesOrder,
  newStatus,
  changedBy,
  reason
) => {
  const oldStatus = salesOrder.status;

  // Validate state transition
  const validTransitions = {
    DRAFT: ["DRAFT", "CONFIRMED", "CANCELLED", "ADMINMODE"],
    CONFIRMED: ["CONFIRMED", "SHIPPED", "INVOICED", "CANCELLED", "ADMINMODE"],
    SHIPPED: ["SHIPPED", "DELIVERED", "INVOICED", "ADMINMODE"],
    DELIVERED: ["DELIVERED", "INVOICED", "ADMINMODE"],
    INVOICED: ["INVOICED", "ADMINMODE"],
    CANCELLED: ["CANCELLED", "ADMINMODE"],
    ADMINMODE: [
      "DRAFT",
      "CONFIRMED",
      "CANCELLED",
      "SHIPPED",
      "DELIVERED",
      "INVOICED",
      "ADMINMODE",
    ],
  };

  if (!validTransitions[oldStatus].includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${oldStatus} to ${newStatus}.`
    );
  }

  // // Update status
  // salesOrder.status = newStatus;

  // // Add to status history
  // salesOrder.statusHistory.push({
  //   oldStatus,
  //   newStatus,
  //   changedBy,
  //   reason: reason || "No Reason Provided",
  //   timestamp: new Date(),
  // });
};

// Not used for now from here
export const deleteAllSalesOrders1 = async (req, res) => {
  try {
    const deletedResponse = await SalesOrderModel.deleteMany({});

    const resetCounter = await SalesOrderCounterModel.findOneAndUpdate(
      { _id: "salesOrderCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );

    if (deletedResponse.deletedCount === 0) {
      return res.status(404).send({
        status: "failure",
        message: "No sales orders found to delete.",
      });
    }

    return res.status(200).send({
      status: "success",
      message: `${deletedResponse.deletedCount} sales orders deleted successfully.`,
      data: {
        deletedCount: deletedResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    logError("Delete All Sales Orders", error);
    return res.status(500).send({
      status: "failure",
      message: "Error deleting all sales orders.",
      error: error.message,
    });
  }
};

export const addPaymentV1 = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const { amount, transactionId, paymentMode, date } = req.body;

    // if (!amount || amount <= 0) {
    //   return res
    //     .status(400)
    //     .json({ error: "A positive payment amount is required." });
    // }
    if (!amount) {
      return res.status(400).json({ error: "A payment amount is required." });
    }

    // Push the new payment object into the paidAmt array
    const order = await SalesOrderModel.findByIdAndUpdate(
      salesOrderId,
      {
        $push: {
          paidAmt: {
            amount,
            transactionId,
            paymentMode,
            date: date || Date.now(),
          },
        },
      },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ error: "Sales Order not found." });
    }

    // Recalculate netAmountAfterAdvance using the updated totalPaid (virtual)
    const totalPaid = order.paidAmt.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    order.netPaymentDue =
      Math.round((order.netAR - order.advance - totalPaid) * 100) / 100;
    await order.save();

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const splitSalesOrder = async (originalOrderId, splitDetails) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const originalOrder = await SalesOrderModel.findById(
      originalOrderId
    ).session(session);
    if (!originalOrder) {
      throw new Error("Original Sales Order not found");
    }

    // Create a new sales order with a portion of the original order
    const newOrder = new SalesOrderModel({
      customer: originalOrder.customer,
      item: originalOrder.item,
      quantity: splitDetails.newQuantity,
      price: originalOrder.price,
      charges: originalOrder.charges / 2, // Assuming proportional split
      discount: originalOrder.discount / 2,
      tax: originalOrder.tax,
      linkedSalesOrders: [originalOrder._id], // Linking back to the original order
    });

    await newOrder.save({ session });

    // Update original order to reflect the split
    originalOrder.quantity -= splitDetails.newQuantity;
    originalOrder.linkedSalesOrders.push(newOrder._id);
    await originalOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      message: "Sales Order successfully split",
      newOrder,
      originalOrder,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const transferSalesOrderItems = async (
  fromOrderId,
  toOrderId,
  transferQuantity
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fromOrder = await SalesOrderModel.findById(fromOrderId).session(
      session
    );
    const toOrder = await SalesOrderModel.findById(toOrderId).session(session);

    if (!fromOrder || !toOrder) {
      throw new Error("One or both Sales Orders not found");
    }

    // Validate transfer quantity
    if (fromOrder.quantity < transferQuantity) {
      throw new Error("Transfer quantity exceeds available quantity.");
    }

    // Adjust quantities
    fromOrder.quantity -= transferQuantity;
    toOrder.quantity += transferQuantity;

    // Link the orders
    fromOrder.linkedSalesOrders.push(toOrder._id);
    toOrder.linkedSalesOrders.push(fromOrder._id);

    await fromOrder.save({ session });
    await toOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      message: `Successfully transferred ${transferQuantity} units.`,
      fromOrder,
      toOrder,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/// Other methods which are not in use

export const patchSalesOrderByIdWithTracking = async (req, res) => {
  const { salesOrderId } = req.params;
  const updates = req.body;
  const changedBy = req.user?.name || "SystemPatch"; // Assuming user info is in `req.user`

  try {
    // Find the existing sales order
    const salesOrder = await SalesOrderModel.findById(salesOrderId);
    if (!salesOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Sales order with ID ${salesOrderId} not found.`,
      });
    }

    // Validate state transition
    if (updates.status) {
      const oldStatus = salesOrder.status;
      const newStatus = updates.status;

      const validTransitions = {
        Draft: ["Draft", "Confirmed", "Cancelled", "AdminMode"],
        Confirmed: [
          "Confirmed",
          "Shipped",
          "Invoiced",
          "Cancelled",
          "AdminMode",
        ],
        Shipped: ["Shipped", "Delivered", "Invoiced", "AdminMode"],
        Delivered: ["Delivered", "Invoiced", "AdminMode"],
        Invoiced: ["Invoiced", "AdminMode"],
        Cancelled: ["Cancelled", "AdminMode"],
        AdminMode: [
          "Draft",
          "Confirmed",
          "Cancelled",
          "Shipped",
          "Delivered",
          "Invoiced",
          "AdminMode",
        ],
      };

      if (!validTransitions[oldStatus].includes(newStatus)) {
        return res.status(400).send({
          status: "failure",
          message: `Invalid status transition from ${oldStatus} to ${newStatus}.`,
        });
      }
    }
    // Track changes
    const changeHistory = await trackFieldChanges(
      salesOrder,
      updates,
      changedBy,
      updates.reason // Optional reason
    );

    // Update sales order fields
    Object.keys(updates).forEach((key) => {
      if (key !== "reason") salesOrder[key] = updates[key];
    });

    // Append change history
    salesOrder.changeHistory.push(...changeHistory);

    // Save the updated sales order
    const updatedSalesOrder = await salesOrder.save();

    return res.status(200).send({
      status: "success",
      message: "Sales order updated successfully.",
      data: updatedSalesOrder,
    });
  } catch (error) {
    console.error("Error updating sales order:", error);
    return res.status(500).send({
      status: "failure",
      message: `Error updating sales order with ID ${salesOrderId}.`,
      error: error.message,
    });
  }
};

// helper methods

export const trackFieldChanges = async (
  salesOrder,
  updates,
  changedBy,
  reason
) => {
  const fieldsToTrack = ["quantity", "price", "status"]; // Specify fields to track
  const changeHistory = [];

  fieldsToTrack.forEach((field) => {
    if (updates[field] !== undefined && updates[field] !== salesOrder[field]) {
      changeHistory.push({
        field,
        oldValue: salesOrder[field],
        newValue: updates[field],
        changedBy,
        reason: reason || "No reason provided",
        timestamp: new Date(),
      });
    }
  });

  return changeHistory;
};
