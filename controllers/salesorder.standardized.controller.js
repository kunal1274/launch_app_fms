/**
 * Standardized Sales Order Controller
 * Consistent with other module controllers
 */

import mongoose from 'mongoose';
import { SalesOrderModel, ORDER_STATUS, STATUS_TRANSITIONS } from '../models/salesorder.standardized.model.js';
import { CustomerModel } from '../models/customer.model.js';
import { ItemModel } from '../models/item.model.js';
import { logError } from '../utility/logError.utils.js';

// Helper functions
const sendErrorResponse = (res, statusCode, message, error = null) => {
  return res.status(statusCode).json({
    status: 'failure',
    message: `❌ ${message}`,
    error: error?.message || error,
    timestamp: new Date().toISOString()
  });
};

const sendSuccessResponse = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json({
    status: 'success',
    message: `✅ ${message}`,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Create a new sales order
 */
export const createSalesOrder = async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate required fields
    if (!orderData.customer || !orderData.lineItems || !Array.isArray(orderData.lineItems) || orderData.lineItems.length === 0) {
      return sendErrorResponse(res, 422, 'Customer and line items are required');
    }
    
    // Validate customer exists
    const customer = await CustomerModel.findById(orderData.customer);
    if (!customer) {
      return sendErrorResponse(res, 404, 'Customer not found');
    }
    
    // Validate line items
    for (const lineItem of orderData.lineItems) {
      if (!lineItem.item || !lineItem.quantity || !lineItem.unitPrice) {
        return sendErrorResponse(res, 422, 'Each line item must have item, quantity, and unit price');
      }
      
      const item = await ItemModel.findById(lineItem.item);
      if (!item) {
        return sendErrorResponse(res, 404, `Item with ID ${lineItem.item} not found`);
      }
    }
    
    // Set default values
    orderData.status = orderData.status || ORDER_STATUS.DRAFT;
    orderData.orderType = orderData.orderType || 'Sales';
    orderData.currency = orderData.currency || customer.currency || 'INR';
    orderData.shippingAddress = orderData.shippingAddress || customer.address || '';
    orderData.billingAddress = orderData.billingAddress || customer.address || '';
    
    const salesOrder = new SalesOrderModel(orderData);
    await salesOrder.save();
    
    sendSuccessResponse(res, 201, `Sales order created successfully with order number: ${salesOrder.orderNum}`, salesOrder);
  } catch (error) {
    logError('Sales Order Creation', error);
    
    if (error instanceof mongoose.Error.ValidationError) {
      return sendErrorResponse(res, 422, 'Validation error during sales order creation', error);
    }
    
    if (error.code === 11000) {
      return sendErrorResponse(res, 409, 'Sales order with this order number already exists');
    }
    
    return sendErrorResponse(res, 500, 'An unexpected error occurred while creating sales order', error);
  }
};

/**
 * Get all sales orders with pagination and filtering
 */
export const getSalesOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      customer,
      startDate,
      endDate,
      search,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = req.query;
    
    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }
    
    if (search) {
      filter.$or = [
        { orderNum: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { remarks: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const [orders, totalCount] = await Promise.all([
      SalesOrderModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      SalesOrderModel.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    sendSuccessResponse(res, 200, 'Sales orders retrieved successfully', {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    logError('Get Sales Orders', error);
    return sendErrorResponse(res, 500, 'Error retrieving sales orders', error);
  }
};

/**
 * Get a single sales order by ID
 */
export const getSalesOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    sendSuccessResponse(res, 200, 'Sales order retrieved successfully', order);
  } catch (error) {
    logError('Get Sales Order', error);
    return sendErrorResponse(res, 500, 'Error retrieving sales order', error);
  }
};

/**
 * Update a sales order
 */
export const updateSalesOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    // Check if order can be modified
    if (![ORDER_STATUS.DRAFT, ORDER_STATUS.CONFIRMED].includes(order.status)) {
      return sendErrorResponse(res, 400, 'Order cannot be modified in current status');
    }
    
    // Update order
    Object.assign(order, updateData);
    order.updatedBy = req.user?.id || 'System';
    
    await order.save();
    
    sendSuccessResponse(res, 200, 'Sales order updated successfully', order);
  } catch (error) {
    logError('Update Sales Order', error);
    
    if (error instanceof mongoose.Error.ValidationError) {
      return sendErrorResponse(res, 422, 'Validation error during sales order update', error);
    }
    
    return sendErrorResponse(res, 500, 'Error updating sales order', error);
  }
};

/**
 * Delete a sales order
 */
export const deleteSalesOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    // Check if order can be deleted
    if (order.status === ORDER_STATUS.INVOICED || order.status === ORDER_STATUS.COMPLETED) {
      return sendErrorResponse(res, 400, 'Cannot delete invoiced or completed orders');
    }
    
    await SalesOrderModel.findByIdAndDelete(orderId);
    
    sendSuccessResponse(res, 200, 'Sales order deleted successfully');
  } catch (error) {
    logError('Delete Sales Order', error);
    return sendErrorResponse(res, 500, 'Error deleting sales order', error);
  }
};

/**
 * Change sales order status
 */
export const changeSalesOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newStatus } = req.body;
    
    if (!newStatus) {
      return sendErrorResponse(res, 422, 'New status is required');
    }
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    // Validate status transition
    if (!order.canChangeStatus(newStatus)) {
      return sendErrorResponse(res, 400, `Invalid status transition from ${order.status} to ${newStatus}`);
    }
    
    // Update status
    order.status = newStatus;
    order.updatedBy = req.user?.id || 'System';
    
    // Set invoice date if status is Invoiced
    if (newStatus === ORDER_STATUS.INVOICED && !order.invoiceDate) {
      order.invoiceDate = new Date();
    }
    
    await order.save();
    
    sendSuccessResponse(res, 200, `Sales order status changed to ${newStatus}`, order);
  } catch (error) {
    logError('Change Sales Order Status', error);
    return sendErrorResponse(res, 500, 'Error changing sales order status', error);
  }
};

/**
 * Add payment to sales order
 */
export const addSalesOrderPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const paymentData = req.body;
    
    if (!paymentData.amount || paymentData.amount <= 0) {
      return sendErrorResponse(res, 422, 'Valid payment amount is required');
    }
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    // Add payment
    const payment = order.addPayment(paymentData);
    await order.save();
    
    sendSuccessResponse(res, 201, 'Payment added successfully', { order, payment });
  } catch (error) {
    logError('Add Sales Order Payment', error);
    return sendErrorResponse(res, 500, 'Error adding payment', error);
  }
};

/**
 * Get sales order payments
 */
export const getSalesOrderPayments = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    sendSuccessResponse(res, 200, 'Payments retrieved successfully', order.payments);
  } catch (error) {
    logError('Get Sales Order Payments', error);
    return sendErrorResponse(res, 500, 'Error retrieving payments', error);
  }
};

/**
 * Generate invoice for sales order
 */
export const generateSalesInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    // Check if order can be invoiced
    if (order.status !== ORDER_STATUS.CONFIRMED) {
      return sendErrorResponse(res, 400, 'Only confirmed orders can be invoiced');
    }
    
    // Generate invoice number
    const invoiceNum = `INV_${order.orderNum}_${Date.now()}`;
    
    // Update order
    order.status = ORDER_STATUS.INVOICED;
    order.invoiceNum = invoiceNum;
    order.invoiceDate = new Date();
    order.updatedBy = req.user?.id || 'System';
    
    await order.save();
    
    sendSuccessResponse(res, 200, 'Invoice generated successfully', {
      order,
      invoiceNum,
      invoiceDate: order.invoiceDate
    });
  } catch (error) {
    logError('Generate Sales Invoice', error);
    return sendErrorResponse(res, 500, 'Error generating invoice', error);
  }
};

/**
 * Search sales orders
 */
export const searchSalesOrders = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    if (!q) {
      return sendErrorResponse(res, 422, 'Search query is required');
    }
    
    const filter = {
      $or: [
        { orderNum: { $regex: q, $options: 'i' } },
        { 'customer.name': { $regex: q, $options: 'i' } },
        { remarks: { $regex: q, $options: 'i' } }
      ]
    };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, totalCount] = await Promise.all([
      SalesOrderModel.find(filter)
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SalesOrderModel.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    sendSuccessResponse(res, 200, 'Search completed successfully', {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logError('Search Sales Orders', error);
    return sendErrorResponse(res, 500, 'Error searching sales orders', error);
  }
};

/**
 * Get sales order summary
 */
export const getSalesOrderSummary = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const filter = {};
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }
    if (status) filter.status = status;
    
    const summary = await SalesOrderModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalBalance: { $sum: '$balanceAmount' },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    const statusCounts = await SalesOrderModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    sendSuccessResponse(res, 200, 'Summary retrieved successfully', {
      summary: summary[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalBalance: 0,
        averageOrderValue: 0
      },
      statusCounts
    });
  } catch (error) {
    logError('Get Sales Order Summary', error);
    return sendErrorResponse(res, 500, 'Error retrieving summary', error);
  }
};

/**
 * Bulk create sales orders
 */
export const bulkCreateSalesOrders = async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return sendErrorResponse(res, 422, 'Orders array is required and must not be empty');
    }
    
    // Validate each order
    const validationErrors = [];
    for (let i = 0; i < orders.length; i++) {
      if (!orders[i].customer || !orders[i].lineItems || !Array.isArray(orders[i].lineItems)) {
        validationErrors.push(`Order ${i + 1}: customer and lineItems are required`);
      }
    }
    
    if (validationErrors.length > 0) {
      return sendErrorResponse(res, 422, 'Validation errors found', validationErrors);
    }
    
    const createdOrders = await SalesOrderModel.insertMany(orders);
    
    sendSuccessResponse(res, 201, `${createdOrders.length} sales orders created successfully`, createdOrders);
  } catch (error) {
    logError('Bulk Create Sales Orders', error);
    return sendErrorResponse(res, 500, 'Error creating sales orders in bulk', error);
  }
};

/**
 * Archive sales order
 */
export const archiveSalesOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    order.archived = true;
    order.updatedBy = req.user?.id || 'System';
    await order.save();
    
    sendSuccessResponse(res, 200, 'Sales order archived successfully', order);
  } catch (error) {
    logError('Archive Sales Order', error);
    return sendErrorResponse(res, 500, 'Error archiving sales order', error);
  }
};

/**
 * Unarchive sales order
 */
export const unarchiveSalesOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await SalesOrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, 'Sales order not found');
    }
    
    order.archived = false;
    order.updatedBy = req.user?.id || 'System';
    await order.save();
    
    sendSuccessResponse(res, 200, 'Sales order unarchived successfully', order);
  } catch (error) {
    logError('Unarchive Sales Order', error);
    return sendErrorResponse(res, 500, 'Error unarchiving sales order', error);
  }
};