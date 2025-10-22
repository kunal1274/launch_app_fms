/**
 * Standardized Sales Order Model
 * Simplified and consistent with other modules
 */

import mongoose, { Schema, model } from 'mongoose';
import { SalesOrderCounterModel } from './counter.model.js';

// Simplified status management
export const ORDER_STATUS = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  INVOICED: 'Invoiced',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.INVOICED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.INVOICED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.COMPLETED]: []
};

// Payment terms helper
export function getDaysFromPaymentTerm(paymentTerm) {
  const terms = {
    'COD': 0,
    'Net7D': 7,
    'Net15D': 15,
    'Net30D': 30,
    'Net45D': 45,
    'Net60D': 60,
    'Net90D': 90,
    'Advance': 0
  };
  return terms[paymentTerm] || 0;
}

// Line item schema
const lineItemSchema = new Schema({
  lineNum: {
    type: String,
    required: true
  },
  item: {
    type: Schema.Types.ObjectId,
    ref: 'Items',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    set: (v) => Math.round(v * 100) / 100
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative'],
    max: [100, 'Tax cannot exceed 100%'],
    set: (v) => Math.round(v * 100) / 100
  },
  lineTotal: {
    type: Number,
    required: true,
    min: [0, 'Line total cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  // Inventory dimensions
  dimensions: {
    site: { type: Schema.Types.ObjectId, ref: 'Sites' },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouses' },
    zone: { type: Schema.Types.ObjectId, ref: 'Zones' },
    location: { type: Schema.Types.ObjectId, ref: 'Locations' },
    aisle: { type: Schema.Types.ObjectId, ref: 'Aisles' },
    rack: { type: Schema.Types.ObjectId, ref: 'Racks' },
    shelf: { type: Schema.Types.ObjectId, ref: 'Shelves' },
    bin: { type: Schema.Types.ObjectId, ref: 'Bins' },
    config: { type: Schema.Types.ObjectId, ref: 'Configurations' },
    color: { type: Schema.Types.ObjectId, ref: 'Colors' },
    size: { type: Schema.Types.ObjectId, ref: 'Sizes' },
    style: { type: Schema.Types.ObjectId, ref: 'Styles' },
    version: { type: Schema.Types.ObjectId, ref: 'Versions' },
    batch: { type: Schema.Types.ObjectId, ref: 'Batches' },
    serial: { type: Schema.Types.ObjectId, ref: 'Serials' }
  }
});

// Payment schema
const paymentSchema = new Schema({
  paymentId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Payment amount cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  paymentMode: {
    type: String,
    required: true,
    enum: {
      values: ['Cash', 'CreditCard', 'DebitCard', 'Online', 'UPI', 'Crypto', 'Barter'],
      message: 'Invalid payment mode'
    },
    default: 'Cash'
  },
  transactionId: {
    type: String,
    required: false
  },
  remarks: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
    default: 'Completed'
  }
});

// Main sales order schema
const salesOrderSchema = new Schema({
  // Identification
  orderNum: {
    type: String,
    required: true,
    unique: true
  },
  orderType: {
    type: String,
    required: true,
    enum: {
      values: ['Sales', 'Return'],
      message: 'Order type must be either Sales or Return'
    },
    default: 'Sales'
  },
  
  // References
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customers',
    required: true
  },
  
  // Line items
  lineItems: [lineItemSchema],
  
  // Financial summary
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  totalDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Total discount cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  totalTax: {
    type: Number,
    default: 0,
    min: [0, 'Total tax cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  
  // Payment information
  paymentTerms: {
    type: String,
    required: true,
    enum: {
      values: ['COD', 'Net7D', 'Net15D', 'Net30D', 'Net45D', 'Net60D', 'Net90D', 'Advance'],
      message: 'Invalid payment terms'
    },
    default: 'Net30D'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  balanceAmount: {
    type: Number,
    required: true,
    min: [0, 'Balance amount cannot be negative'],
    set: (v) => Math.round(v * 100) / 100
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: {
      values: Object.values(ORDER_STATUS),
      message: 'Invalid order status'
    },
    default: ORDER_STATUS.DRAFT
  },
  
  // Dates
  orderDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: false
  },
  invoiceDate: {
    type: Date,
    required: false
  },
  
  // Invoice information
  invoiceNum: {
    type: String,
    required: false,
    default: null
  },
  voucherId: {
    type: Schema.Types.ObjectId,
    ref: 'FinancialVouchers',
    required: false
  },
  voucherNo: {
    type: String,
    required: false
  },
  
  // Payment tracking
  payments: [paymentSchema],
  
  // Address and shipping
  shippingAddress: {
    type: String,
    required: false,
    default: ''
  },
  billingAddress: {
    type: String,
    required: false,
    default: ''
  },
  
  // Currency and exchange
  currency: {
    type: String,
    required: true,
    enum: {
      values: ['INR', 'USD', 'EUR', 'GBP'],
      message: 'Invalid currency'
    },
    default: 'INR'
  },
  exchangeRate: {
    type: Number,
    default: 1,
    min: [0, 'Exchange rate cannot be negative']
  },
  
  // Additional information
  remarks: {
    type: String,
    default: ''
  },
  
  // System fields
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Companies',
    required: true
  },
  createdBy: {
    type: String,
    required: true,
    default: 'System'
  },
  updatedBy: {
    type: String,
    required: false
  },
  active: {
    type: Boolean,
    default: true
  },
  archived: {
    type: Boolean,
    default: false
  },
  
  // File attachments
  files: [{
    fileName: { type: String, required: true },
    fileOriginalName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileUploadedAt: { type: Date, default: Date.now }
  }],
  
  // Groups
  groups: [{
    type: Schema.Types.ObjectId,
    ref: 'GlobalGroups'
  }],
  
  // Extras
  extras: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total paid amount
salesOrderSchema.virtual('totalPaid').get(function() {
  return this.payments.reduce((sum, payment) => sum + payment.amount, 0);
});

// Virtual for payment status
salesOrderSchema.virtual('paymentStatus').get(function() {
  if (this.balanceAmount <= 0) return 'Paid';
  if (this.paidAmount > 0) return 'Partial';
  return 'Pending';
});

// Pre-save middleware
salesOrderSchema.pre('save', async function(next) {
  try {
    // Generate order number for new orders
    if (this.isNew) {
      const counter = await SalesOrderCounterModel.findByIdAndUpdate(
        { _id: 'salesOrderCode' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      if (!counter || counter.seq === undefined) {
        throw new Error('Failed to generate sales order number');
      }
      
      const seqNumber = counter.seq.toString().padStart(6, '0');
      this.orderNum = `SO_${seqNumber}`;
    }
    
    // Calculate financial totals
    this.calculateTotals();
    
    // Set due date based on payment terms
    if (this.invoiceDate && this.paymentTerms) {
      const days = getDaysFromPaymentTerm(this.paymentTerms);
      this.dueDate = new Date(this.invoiceDate.getTime() + (days * 24 * 60 * 60 * 1000));
    }
    
    // Update balance amount
    this.balanceAmount = this.totalAmount - this.paidAmount;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to calculate totals
salesOrderSchema.methods.calculateTotals = function() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  
  this.lineItems.forEach(item => {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineDiscount = (item.discount / 100) * lineSubtotal;
    const lineTaxableAmount = lineSubtotal - lineDiscount;
    const lineTax = (item.tax / 100) * lineTaxableAmount;
    
    item.lineTotal = lineSubtotal - lineDiscount + lineTax;
    
    subtotal += lineSubtotal;
    totalDiscount += lineDiscount;
    totalTax += lineTax;
  });
  
  this.subtotal = subtotal;
  this.totalDiscount = totalDiscount;
  this.totalTax = totalTax;
  this.totalAmount = subtotal - totalDiscount + totalTax;
};

// Method to validate status transition
salesOrderSchema.methods.canChangeStatus = function(newStatus) {
  return STATUS_TRANSITIONS[this.status]?.includes(newStatus) || false;
};

// Method to add payment
salesOrderSchema.methods.addPayment = function(paymentData) {
  const payment = {
    paymentId: `PAY_${Date.now()}`,
    ...paymentData
  };
  
  this.payments.push(payment);
  this.paidAmount = this.totalPaid;
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  return payment;
};

// Indexes
salesOrderSchema.index({ orderNum: 1 });
salesOrderSchema.index({ customer: 1 });
salesOrderSchema.index({ status: 1 });
salesOrderSchema.index({ orderDate: 1 });
salesOrderSchema.index({ company: 1 });

// Pre-find middleware to populate references
salesOrderSchema.pre(/^find/, function(next) {
  this.populate('customer', 'code name contactNum email address')
    .populate('lineItems.item', 'code name price type unit')
    .populate('company', 'name code');
  next();
});

export const SalesOrderModel = mongoose.models.SalesOrders || model('SalesOrders', salesOrderSchema);