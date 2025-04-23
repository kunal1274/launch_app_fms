// import { PurchaseOrderModel } from "../models/purchaseorders.muuSHakaH.model.js";
import mongoose from "mongoose";
import { PurchaseOrderModel } from "../models/purchaseorder.model.js";
import { PurchaseOrderCounterModel } from "../models/counter.model.js";
import { ItemModel } from "../models/item.model.js";
import { VendorModel } from "../models/vendor.model.js";
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
  const counter = await PurchaseOrderCounterModel.findByIdAndUpdate(
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

export const createPurchaseOrder = async (req, res) => {
  const purchaseOrderBody = req.body;

  try {
    // Check for required fields
    if (!purchaseOrderBody.vendor || !purchaseOrderBody.item) {
      return res.status(422).send({
        status: "failure",
        message: "Vendor and Item are required fields.",
      });
    }

    // Validate existence of the vendor
    const vendorExists = await VendorModel.findById(purchaseOrderBody.vendor);
    if (!vendorExists) {
      return res.status(404).send({
        status: "failure",
        message: `Vendor with ID ${purchaseOrderBody.vendor} does not exist.`,
      });
    }

    // Validate existence of the item
    const itemExists = await ItemModel.findById(purchaseOrderBody.item);
    if (!itemExists) {
      return res.status(404).send({
        status: "failure",
        message: `Item with ID ${purchaseOrderBody.item} does not exist.`,
      });
    }

    // Create Purchase Order
    const dbResponseNewPurchaseOrder = await PurchaseOrderModel.create(
      purchaseOrderBody
    );

    console.log(
      `Purchase order has been created successfully with id: ${
        dbResponseNewPurchaseOrder._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`
    );

    return res.status(201).send({
      status: "success",
      message: `Purchase order has been created successfully with id: ${
        dbResponseNewPurchaseOrder._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`,
      data: dbResponseNewPurchaseOrder,
    });
  } catch (error) {
    // Database Validation Error
    if (error instanceof mongoose.Error.ValidationError) {
      logError("Purchase Order Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "Validation error during purchase order creation.",
        error: error.message || error,
      });
    }

    // MongoDB Duplicate Key Error
    if (error.code === 11000) {
      logError("Purchase Order Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "A purchase order with the same order number already exists.",
      });
    }

    // Handle MongoDB connection or network issues
    if (error.message.includes("network error")) {
      logError("Purchase Order Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logError("Purchase Order Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message: "An unexpected error occurred. Please try again.",
      error: error.message || error,
    });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  const { purchaseOrderId } = req.params;

  try {
    // Use populate to fetch vendor and item details
    const purchaseOrder = await PurchaseOrderModel.findById(purchaseOrderId)
      .populate("vendor", "name contactNum address")
      .populate("item", "name description price type unit");

    if (!purchaseOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Purchase order with ID ${purchaseOrderId} not found.`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Purchase order retrieved successfully.",
      data: purchaseOrder,
    });
  } catch (error) {
    logError("Get Purchase Order By ID", error);
    return res.status(500).send({
      status: "failure",
      message: `Error retrieving purchase order with ID ${purchaseOrderId}.`,
      error: error.message,
    });
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  const { archived } = req.query; // Check if archived filter is passed
  const filter = { archived: false };
  if (archived === "false") filter = {};
  if (archived === "true") filter.archived = true;
  //if (archived === "false") filter.archived = false;
  try {
    // Retrieve all purchase orders with vendor and item details populated
    const purchaseOrders = await PurchaseOrderModel.find(filter)
      .populate("vendor", "name contactNum address")
      .populate(
        "item",
        "name description price purchPrice purchasePrice invPrice type unit"
      );

    if (!purchaseOrders || purchaseOrders.length === 0) {
      return res.status(404).send({
        status: "failure",
        message: "No purchase orders found.",
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Purchase orders retrieved successfully.",
      count: purchaseOrders.length,
      user: req.user?.email,
      data: purchaseOrders,
    });
  } catch (error) {
    logError("Get All Purchase Orders", error);
    return res.status(500).send({
      status: "failure",
      message: "Error retrieving purchase orders.",
      error: error.message,
    });
  }
};

export const updatePurchaseOrderById = async (req, res) => {
  const { purchaseOrderId } = req.params;
  const updatedData = req.body;

  try {
    // Check for required fields
    if (!updatedData.vendor || !updatedData.item) {
      return res.status(422).send({
        status: "failure",
        message: "Vendor and Item are required fields.",
      });
    }

    const updatedPurchaseOrder = await PurchaseOrderModel.findByIdAndUpdate(
      purchaseOrderId,
      updatedData,
      { new: true, runValidators: true }
    )
      .populate("vendor", "name contactNum address")
      .populate("item", "name description price type unit");

    if (!updatedPurchaseOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Purchase order with ID ${purchaseOrderId} not found.`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Purchase order updated successfully.",
      data: updatedPurchaseOrder,
    });
  } catch (error) {
    logError("Update Purchase Order By ID", error);

    // Validation Error Handling
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(422).send({
        status: "failure",
        message: "Validation error during purchase order update.",
        error: error.message,
      });
    }

    return res.status(500).send({
      status: "failure",
      message: `Error updating purchase order with ID ${purchaseOrderId}.`,
      error: error.message,
    });
  }
};

export const archivePurchaseOrderById = async (req, res) => {
  const { purchaseOrderId } = req.params;
  try {
    const updatedOrder = await PurchaseOrderModel.findByIdAndUpdate(
      purchaseOrderId,
      { archived: true },
      { new: true } // Return the updated document
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Error archiving purchase order", error });
  }
};

export const unarchivePurchaseOrderById = async (req, res) => {
  const { purchaseOrderId } = req.params;
  try {
    const updatedOrder = await PurchaseOrderModel.findByIdAndUpdate(
      purchaseOrderId,
      { archived: false },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    res.status(200).json(updatedOrder);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error unarchiving purchase order", error });
  }
};

export const getArchivedPurchaseOrders = async (req, res) => {
  try {
    const archivedOrders = await PurchaseOrderModel.find({ archived: true });
    if (!archivedOrders) {
      return res.status(404).send({
        status: "failure",
        message:
          "No Archived purchase order found or failed to retrieve the archived PO",
        count: 0,
        data: [],
      });
    }
    return res.status(200).send({
      status: "success",
      message: "Archived Purchase order are fetched successfully.",
      count: archivedOrders.length,
      data: archivedOrders,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching archived purchase orders", error });
  }
};

export const deletePurchaseOrderById = async (req, res) => {
  const { purchaseOrderId } = req.params;
  if (!purchaseOrderId) {
    return res.status(422).send({
      status: "failure",
      message: `The request parameter or body can't be blank`,
    });
  }

  try {
    //const purchaseOrder = await PurchaseOrderModel.findById(purchaseOrderId);
    // if (purchaseOrder.status !== "Draft") {
    //   return res.status(400).send({
    //     status: "failure",
    //     message: `The purchase order with other than Draft status can't be deleted`,
    //   });
    // }
    const deletedPurchaseOrder = await PurchaseOrderModel.findByIdAndDelete(
      purchaseOrderId
    );

    if (!deletedPurchaseOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Purchase order with ID ${purchaseOrderId} not found.`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: `Purchase order with ID ${purchaseOrderId} deleted successfully.`,
      data: deletedPurchaseOrder,
    });
  } catch (error) {
    logError("Delete Purchase Order By ID", error);
    return res.status(500).send({
      status: "failure",
      message: `Error deleting purchase order with ID ${purchaseOrderId}.`,
      error: error.message,
    });
  }
};

export const deleteAllPurchaseOrders = async (req, res) => {
  try {
    console.log("Starting bulk delete...");

    // Delete all purchase orders
    const deletedResponse = await PurchaseOrderModel.deleteMany({});
    console.log("Deleted Response:", deletedResponse);

    // Reset the counter
    const resetCounter = await PurchaseOrderCounterModel.findOneAndUpdate(
      { _id: "purchaseOrderCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );
    console.log("Counter Reset Response:", resetCounter);

    if (deletedResponse.deletedCount === 0) {
      return res.status(200).send({
        status: "success",
        message: "No purchase orders to delete.",
        data: { deletedCount: 0 },
      });
    }

    return res.status(200).send({
      status: "success",
      message: `${deletedResponse.deletedCount} purchase orders deleted successfully.`,
      data: {
        deletedCount: deletedResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    console.error("Error deleting purchase orders:", error);
    return res.status(500).send({
      status: "failure",
      message: "Error deleting all purchase orders.",
      error: error.message,
    });
  }
};

/**
 * Add a payment to a Purchase Order.
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
    const { purchaseOrderId } = req.params;
    const { amount, transactionId, paymentMode, date } = req.body;
    // if (!amount || amount <= 0) {
    //   return res
    //     .status(400)
    //     .json({ error: "A positive payment amount is required." });
    // }
    if (!amount) {
      return res.status(400).json({ error: "A payment amount is required." });
    }
    // Retrieve the purchase order
    const order = await PurchaseOrderModel.findById(purchaseOrderId);
    if (!order) {
      return res.status(404).json({ error: "Purchase Order not found." });
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
 * Change the status of a Purchase Order
 */
export const changePurchaseOrderStatus = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;
    const { newStatus, invoiceDate, dueDate } = req.body; // optionally provided

    if (!newStatus) {
      return res.status(400).json({ error: "New status is required" });
    }

    const order = await PurchaseOrderModel.findById(purchaseOrderId);
    if (!order) {
      return res.status(404).json({ error: "Purchase Order not found" });
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
 * Controller to generate an invoice number for a given Purchase Order.
 * This endpoint updates the invoiceNum field (and optionally sets status to "Invoiced")
 * and returns the updated order.
 */
export const generateInvoiceForOrder = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;
    const order = await PurchaseOrderModel.findById(purchaseOrderId);
    if (!order) {
      return res
        .status(404)
        .json({ status: "failure", message: "Purchase Order not found." });
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

export const deleteDraftPurchaseOrders = async (req, res) => {
  try {
    // Restrict deletion to only 'Draft' purchase orders
    const deletedResponse = await PurchaseOrderModel.deleteMany({
      status: "Draft",
    });

    if (deletedResponse.deletedCount === 0) {
      return res.status(404).send({
        status: "failure",
        message: "No draft purchase orders found to delete.",
      });
    }

    return res.status(200).send({
      status: "success",
      message: `Successfully deleted ${deletedResponse.deletedCount} draft purchase order(s).`,
    });
  } catch (error) {
    console.error("Error deleting draft purchase orders:", error);
    return res.status(500).send({
      status: "failure",
      message: "Error deleting draft purchase orders.",
      error: error.message,
    });
  }
};

export const patchPurchaseOrderById = async (req, res) => {
  const { purchaseOrderId } = req.params;
  const patchedData = req.body;

  try {
    const purchaseOrder = await PurchaseOrderModel.findById(purchaseOrderId);

    if (!purchaseOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Purchase order with ID ${purchaseOrderId} not found.`,
      });
    }

    // Track changes for audit
    const changes = [];
    const changedBy = req.user?.name || "AdminUIPatch"; // Default to admin if no user info is available

    // If status is being updated, handle it separately
    if (patchedData.status && purchaseOrder.status !== patchedData.status) {
      await validatePurchaseOrderStatus(
        purchaseOrder,
        patchedData.status,
        changedBy,
        patchedData.reason || "No Reason Provided"
      );

      changes.push({
        field: "status",
        oldValue: purchaseOrder.status,
        newValue: patchedData.status,
      });
      purchaseOrder.status = patchedData.status;
    }

    // Update other fields
    const allowedFields = ["vendor", "item", "quantity", "price"];
    for (const field of allowedFields) {
      if (patchedData[field] && purchaseOrder[field] !== patchedData[field]) {
        changes.push({
          field,
          oldValue: purchaseOrder[field],
          newValue: patchedData[field],
        });
        purchaseOrder[field] = patchedData[field];
      }
    }

    // Save changes
    const updatedPurchaseOrder = await purchaseOrder.save();

    // Log changes to history (audit tracking)
    if (changes.length > 0) {
      const logEntries = changes.map((change) => ({
        purchaseOrderId,
        changedBy,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason: patchedData.reason || "No Reason Provided",
        timestamp: new Date(),
      }));
      await PurchaseOrderEventLogModel.insertMany(logEntries);
    }

    return res.status(200).send({
      status: "success",
      message: "Purchase order updated successfully.",
      data: updatedPurchaseOrder,
    });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return res.status(500).send({
      status: "failure",
      message: "Error updating purchase order.",
      error: error.message,
    });
  }
};

export const validatePurchaseOrderStatus = async (
  purchaseOrder,
  newStatus,
  changedBy,
  reason
) => {
  const oldStatus = purchaseOrder.status;

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
  // purchaseOrder.status = newStatus;

  // // Add to status history
  // purchaseOrder.statusHistory.push({
  //   oldStatus,
  //   newStatus,
  //   changedBy,
  //   reason: reason || "No Reason Provided",
  //   timestamp: new Date(),
  // });
};

// Not used for now from here
export const deleteAllPurchaseOrders1 = async (req, res) => {
  try {
    const deletedResponse = await PurchaseOrderModel.deleteMany({});

    const resetCounter = await PurchaseOrderCounterModel.findOneAndUpdate(
      { _id: "purchaseOrderCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );

    if (deletedResponse.deletedCount === 0) {
      return res.status(404).send({
        status: "failure",
        message: "No purchase orders found to delete.",
      });
    }

    return res.status(200).send({
      status: "success",
      message: `${deletedResponse.deletedCount} purchase orders deleted successfully.`,
      data: {
        deletedCount: deletedResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    logError("Delete All Purchase Orders", error);
    return res.status(500).send({
      status: "failure",
      message: "Error deleting all purchase orders.",
      error: error.message,
    });
  }
};

export const addPaymentV1 = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;
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
    const order = await PurchaseOrderModel.findByIdAndUpdate(
      purchaseOrderId,
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
      return res.status(404).json({ error: "Purchase Order not found." });
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

export const splitPurchaseOrder = async (originalOrderId, splitDetails) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const originalOrder = await PurchaseOrderModel.findById(
      originalOrderId
    ).session(session);
    if (!originalOrder) {
      throw new Error("Original Purchase Order not found");
    }

    // Create a new purchase order with a portion of the original order
    const newOrder = new PurchaseOrderModel({
      vendor: originalOrder.vendor,
      item: originalOrder.item,
      quantity: splitDetails.newQuantity,
      price: originalOrder.price,
      charges: originalOrder.charges / 2, // Assuming proportional split
      discount: originalOrder.discount / 2,
      tax: originalOrder.tax,
      linkedPurchaseOrders: [originalOrder._id], // Linking back to the original order
    });

    await newOrder.save({ session });

    // Update original order to reflect the split
    originalOrder.quantity -= splitDetails.newQuantity;
    originalOrder.linkedPurchaseOrders.push(newOrder._id);
    await originalOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      message: "Purchase Order successfully split",
      newOrder,
      originalOrder,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const transferPurchaseOrderItems = async (
  fromOrderId,
  toOrderId,
  transferQuantity
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fromOrder = await PurchaseOrderModel.findById(fromOrderId).session(
      session
    );
    const toOrder = await PurchaseOrderModel.findById(toOrderId).session(
      session
    );

    if (!fromOrder || !toOrder) {
      throw new Error("One or both Purchase Orders not found");
    }

    // Validate transfer quantity
    if (fromOrder.quantity < transferQuantity) {
      throw new Error("Transfer quantity exceeds available quantity.");
    }

    // Adjust quantities
    fromOrder.quantity -= transferQuantity;
    toOrder.quantity += transferQuantity;

    // Link the orders
    fromOrder.linkedPurchaseOrders.push(toOrder._id);
    toOrder.linkedPurchaseOrders.push(fromOrder._id);

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

export const patchPurchaseOrderByIdWithTracking = async (req, res) => {
  const { purchaseOrderId } = req.params;
  const updates = req.body;
  const changedBy = req.user?.name || "SystemPatch"; // Assuming user info is in `req.user`

  try {
    // Find the existing purchase order
    const purchaseOrder = await PurchaseOrderModel.findById(purchaseOrderId);
    if (!purchaseOrder) {
      return res.status(404).send({
        status: "failure",
        message: `Purchase order with ID ${purchaseOrderId} not found.`,
      });
    }

    // Validate state transition
    if (updates.status) {
      const oldStatus = purchaseOrder.status;
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
      purchaseOrder,
      updates,
      changedBy,
      updates.reason // Optional reason
    );

    // Update purchase order fields
    Object.keys(updates).forEach((key) => {
      if (key !== "reason") purchaseOrder[key] = updates[key];
    });

    // Append change history
    purchaseOrder.changeHistory.push(...changeHistory);

    // Save the updated purchase order
    const updatedPurchaseOrder = await purchaseOrder.save();

    return res.status(200).send({
      status: "success",
      message: "Purchase order updated successfully.",
      data: updatedPurchaseOrder,
    });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return res.status(500).send({
      status: "failure",
      message: `Error updating purchase order with ID ${purchaseOrderId}.`,
      error: error.message,
    });
  }
};

// helper methods

export const trackFieldChanges = async (
  purchaseOrder,
  updates,
  changedBy,
  reason
) => {
  const fieldsToTrack = ["quantity", "price", "status"]; // Specify fields to track
  const changeHistory = [];

  fieldsToTrack.forEach((field) => {
    if (
      updates[field] !== undefined &&
      updates[field] !== purchaseOrder[field]
    ) {
      changeHistory.push({
        field,
        oldValue: purchaseOrder[field],
        newValue: updates[field],
        changedBy,
        reason: reason || "No reason provided",
        timestamp: new Date(),
      });
    }
  });

  return changeHistory;
};
