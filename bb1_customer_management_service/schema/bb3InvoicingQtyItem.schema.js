// invoicingQty.schema.js
import mongoose from 'mongoose';

function getDaysFromPaymentTerm(paymentTerm) {
  switch (paymentTerm) {
  case 'Net7D':
    return 7;
  case 'Net15D':
    return 15;
  case 'Net30D':
    return 30;
  case 'Net45D':
    return 45;
  case 'Net60D':
    return 60;
  case 'Net90D':
    return 90;
  case 'COD':
    return 0;
  case 'Advance':
    return 0;
  default:
    return 0;
  }
}

const InvoicingQtyItemSchema = new mongoose.Schema({
  invoicingId: { type: String },
  extInvoiceId: { type: String, required: true, default: 'NA' },
  qty: {
    type: Number,
    required: true,
    default: 0.0,
    set: (v) => Math.round(v * 100) / 100,
  },
  invoiceDate: { type: Date, default: Date.now },
  externalDocDate: { type: Date, default: Date.now },
  invoicingRef: { type: String, default: false },
  paymentTerms: {
    type: String,
    required: true,
    enum: {
      values: [
        'COD',
        'Net7D',
        'Net15D',
        'Net30D',
        'Net45D',
        'Net60D',
        'Net90D',
        'Advance',
      ],
      message: '{VALUE} is not valid for paymentTerms in invoicingQty.',
    },
    default: 'Net30D',
  },
  dueDate: { type: Date, default: Date.now },
  closedForInvoicingLater: {
    type: Boolean,
    required: true,
    default: false,
  },
  status: {
    type: String,
    required: true,
    enum: ['Draft', 'Posted', 'Cancelled', 'AdminMode', 'AnyMode'],
    default: 'Draft',
  },
});

// subdocument pre save hook
InvoicingQtyItemSchema.pre('save', function (next) {
  // 'this' is the subdocument
  if (this.isModified('invoiceDate') || this.isModified('paymentTerms')) {
    const daysOffset = getDaysFromPaymentTerm(this.paymentTerms);
    const invDate = this.invoiceDate || new Date();
    this.dueDate = new Date(
      invDate.getTime() + daysOffset * 24 * 60 * 60 * 1000
    );
  }
  next();
});

export default InvoicingQtyItemSchema;
