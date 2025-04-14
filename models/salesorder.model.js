import mongoose, { Schema, model } from "mongoose";
import { SalesOrderCounterModel } from "./counter.model.js";

// Define allowed status transitions
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

// Sales Order Schema
const salesOrderSchema1C1I = new Schema(
  {
    orderNum: {
      type: String,
      required: false,
      unique: true,
    },
    orderType: {
      type: String,
      required: true,
      enum: {
        values: ["Sales", "Return"],
        message:
          "{VALUE} is not a valid order type. Use case-sensitive value among these only 'Purchase','Return'.",
      },
      default: "Sales",
    },
    invoiceNum: {
      type: String,
      required: false,
      //unique: true,
      default: "NA",
    },
    // ***** NEW FIELDS ADDED *****
    invoiceDate: {
      type: Date,
      // Not required for non‑invoiced orders;
      // When status is Invoiced, you will validate in the controller.
    },
    dueDate: {
      type: Date,
      // This will be computed as invoiceDate + 30 days if not provided.
    },
    // ******************************
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customers", // Reference to the Customer model
      required: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "Items", // Reference to the Item model
      required: true,
    },
    salesAddress: {
      type: String, // Adjust the type if address is more complex
      required: false, // Ensures that salesAddress is always set
    },
    remarks: {
      type: String, // Adjust the type if address is more complex
      required: false, // Ensures that salesAddress is always set
    },
    advance: {
      type: Number,
      required: true,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    quantity: {
      type: Number,
      required: true,
      default: 1.0,
      set: function (v) {
        return Math.round(v * 100) / 100; // round off during save
      },
    },
    price: {
      type: Number,
      required: true,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    currency: {
      type: String,
      required: true,
      enum: {
        values: ["INR", "USD", "EUR", "GBP"],
        message:
          "{VALUE} is not a valid currency. Use among these only'INR','USD','EUR','GBP'.",
      },
      default: "INR",
    },

    charges: {
      type: Number,
      required: true,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    discount: {
      type: Number,
      required: true,
      default: 0.0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    tax: {
      type: Number,
      required: true,
      default: 0.0,
      min: [0, "Tax cannot be negative"],
      max: [100, "Tax cannot exceed 100%"],
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    withholdingTax: {
      type: Number,
      required: true,
      default: 0.0,
      min: [0, "Withholding Tax cannot be negative"],
      max: [100, "Withholding Tax cannot exceed 100%"],
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },

    lineAmt: {
      type: Number,
      required: true,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100; // this should be a calculation like (qty*price) - discount + charges
      },
    },
    // Computed Fields
    taxAmount: {
      type: Number,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    discountAmt: {
      type: Number,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    withholdingTaxAmt: {
      type: Number,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    netAmtAfterTax: {
      type: Number,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    netAR: {
      type: Number,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },

    // Change shippingQty from an array of numbers to an array of objects for richer metadata
    shippingQty: [
      {
        shipmentId: {
          type: String,
          required: false,
        },
        qty: {
          type: Number,
          required: true,
          default: 0.0,
          set: (v) => Math.round(v * 100) / 100,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        shipmentRef: {
          type: String,
          default: false,
        },
        shipmentMode: {
          type: String,
          required: false,
          enum: {
            values: ["Air", "Road", "Sea"],
            message:
              "{VALUE} is not a supported shipment mode Air or Road or Sea.",
          },
          default: "Road",
        },
        closedForShipmentLater: {
          type: Boolean,
          required: true,
          default: false,
        },
        status: {
          type: String,
          required: true,
          enum: {
            values: ["Draft", "Posted", "Cancelled", "AdminMode", "AnyMode"],
            message:
              "{VALUE} is not a valid status . Use among these only'Draft','Cancelled','Posted','AdminMode','AnyMode'.",
          },
          default: "Draft",
        },
      },
    ],
    // Change shippingQty from an array of numbers to an array of objects for richer metadata
    deliveringQty: [
      {
        deliveryId: {
          type: String,
          required: false,
        },
        qty: {
          type: Number,
          required: true,
          default: 0.0,
          set: (v) => Math.round(v * 100) / 100,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        deliveryRef: {
          type: String,
          default: false,
        },
        deliveryMode: {
          type: String,
          required: false,
          enum: {
            values: ["Air", "Road", "Sea"],
            message:
              "{VALUE} is not a supported delivery mode Air or Road or Sea.",
          },
          default: "Road",
        },
        closedForDeliveryLater: {
          type: Boolean,
          required: true,
          default: false,
        },
        status: {
          type: String,
          required: true,
          enum: {
            values: ["Draft", "Posted", "Cancelled", "AdminMode", "AnyMode"],
            message:
              "{VALUE} is not a valid status . Use among these only'Draft','Cancelled','Posted','AdminMode','AnyMode'.",
          },
          default: "Draft",
        },
      },
    ],
    // Change shippingQty from an array of numbers to an array of objects for richer metadata
    invoicingQty: [
      {
        invoicingId: {
          type: String,
          required: false,
        },
        qty: {
          type: Number,
          required: true,
          default: 0.0,
          set: (v) => Math.round(v * 100) / 100,
        },
        invoiceDate: {
          type: Date,
          default: Date.now,
        },
        externalDocDate: {
          type: Date,
          default: Date.now,
        },
        invoicingRef: {
          type: String,
          default: false,
        },
        paymentTerms: {
          type: String,
          required: true,
          enum: {
            values: ["COD", "Net15", "Net30", "Advance"],
            message:
              "{VALUE} is not a valid payment Terms. Use among these only'COD','Net15','Net30','Advance'.",
          },
          default: "Net30",
        },

        dueDate: {
          type: Date,
          default: Date.now,
          // This will be computed as invoiceDate + 30 days if not provided.
        },
        closedForInvoicingLater: {
          type: Boolean,
          required: true,
          default: false,
        },
        status: {
          type: String,
          required: true,
          enum: {
            values: ["Draft", "Posted", "Cancelled", "AdminMode", "AnyMode"],
            message:
              "{VALUE} is not a valid status . Use among these only'Draft','Cancelled','Posted','AdminMode','AnyMode'.",
          },
          default: "Draft",
        },
      },
    ],
    // Change paidAmt from an array of numbers to an array of objects for richer metadata
    paidAmt: [
      {
        paymentId: {
          type: String,
          required: false,
        },
        amount: {
          type: Number,
          required: true,
          default: 0.0,
          set: (v) => Math.round(v * 100) / 100,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        transactionId: {
          type: String,
          required: false,
        },
        paymentMode: {
          type: String,
          required: false,
          enum: {
            values: [
              "Cash",
              "CreditCard",
              "DebitCard",
              "Online",
              "UPI",
              "Crypto",
              "Barter",
            ],
            message: "{VALUE} is not a supported payment mode.",
          },
          default: "Cash",
        },

        status: {
          type: String,
          required: true,
          enum: {
            values: ["Draft", "Posted", "Cancelled", "AdminMode", "AnyMode"],
            message:
              "{VALUE} is not a valid status . Use among these only'Draft','Cancelled','Posted','AdminMode','AnyMode'.",
          },
          default: "Draft",
        },
      },
    ],
    // New field to capture any extra amount if payments exceed netAR
    carryForwardAdvance: {
      type: Number,
      default: 0.0,
      set: (v) => Math.round(v * 100) / 100,
    },
    netPaymentDue: {
      type: Number,
      default: 0.0,
      set: function (v) {
        return Math.round(v * 100) / 100;
      },
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "Draft",
          "Approved",
          "Confirmed",
          "Shipped", // Outbound Transit
          "Delivered",
          "Invoiced",
          "Cancelled",
          "AdminMode",
          "AnyMode",
        ],
        message:
          "{VALUE} is not a valid status . Use among these only'Draft','Cancelled','Confirmed','Shipped'.'Delivered','Invoiced','AdminMode','AnyMode'.",
      },
      default: "Draft",
    },
    settlementStatus: {
      type: String,
      required: true,
      enum: {
        values: [
          "PAYMENT_PENDING", // no advance and payment yet to be initiated
          "PAYMENT_PARTIAL", // not considering the exisitng advance or advance is zero
          "PAYMENT_FULL", // payment plus exisitng advance matches the net AR
          "PAYMENT_FAILED", // payment failed
          "PAYMENT_FULL_CARRY_FORWARD_ADVANCE", // payment current plus existing advance exceeds the net AR
        ],
        message:
          "{VALUE} is not a valid status .Use  Case-sensitive among these only'PAYMENT_PENDING','PAYMENT_PARTIAL','PAYMENT_FULL','PAYMENT_FAILED'.",
      },
      default: "PAYMENT_PENDING",
    },
    archived: { type: Boolean, default: false }, // New field
    createdBy: {
      type: String,
      required: true,
      default: "SystemSOCreation",
    },
    updatedBy: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
    },
    // New field for file uploads
    files: [
      {
        fileName: { type: String, required: true }, // Name of the file
        fileType: { type: String, required: true }, // MIME type (e.g., "application/pdf", "image/png")
        fileUrl: { type: String, required: true }, // URL/path of the uploaded file
        uploadedAt: { type: Date, default: Date.now }, // Timestamp for the upload
      },
    ],
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        //delete ret.__v;
        // Sort the keys alphabetically for easier reading
        const sorted = {};
        Object.keys(ret)
          .sort()
          .forEach((key) => {
            sorted[key] = ret[key];
          });
        return sorted;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual to calculate the total paid from the paidAmt array
salesOrderSchema1C1I.virtual("totalPaid").get(function () {
  return this.paidAmt && this.paidAmt.length
    ? Math.round(
        this.paidAmt.reduce((sum, payment) => sum + payment.amount, 0) * 100
      ) / 100
    : 0;
});

// Virtual to calculate the total paid from the paidAmt array
salesOrderSchema1C1I.virtual("combinedPaid").get(function () {
  return (this.paidAmt && this.paidAmt.length) || this.advance
    ? Math.round(
        (this.advance +
          this.paidAmt.reduce((sum, payment) => sum + payment.amount, 0)) *
          100
      ) / 100
    : 0;
});

// Method: Update settlement status based on (advance + totalPaid) vs. netAR
salesOrderSchema1C1I.methods.updateSettlementStatus = function () {
  const totalPaid = this.totalPaid;
  const combined = this.advance + totalPaid;
  if (combined === this.netAR) {
    this.settlementStatus = "PAYMENT_FULL";
    this.carryForwardAdvance = 0;
  } else if (combined > this.netAR) {
    this.settlementStatus = "PAYMENT_FULL_CARRY_FORWARD_ADVANCE";
    this.carryForwardAdvance = Math.round((combined - this.netAR) * 100) / 100;
  } else if (combined > 0) {
    this.settlementStatus = "PAYMENT_PARTIAL";
    this.carryForwardAdvance = 0;
  } else {
    this.settlementStatus = "PAYMENT_PENDING";
    this.carryForwardAdvance = 0;
  }
};

// ======================
//  ID GENERATOR HELPERS
// ======================
async function generateShipmentId() {
  const counter = await SalesOrderCounterModel.findByIdAndUpdate(
    { _id: "shipmentNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seqNumber = counter.seq.toString().padStart(6, "0");
  return `2025-26-SHP-${seqNumber}`;
}

async function generateDeliveryId() {
  const counter = await SalesOrderCounterModel.findByIdAndUpdate(
    { _id: "deliveryNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seqNumber = counter.seq.toString().padStart(6, "0");
  return `2025-26-DLV-${seqNumber}`;
}

async function generateInvoicingId() {
  const counter = await SalesOrderCounterModel.findByIdAndUpdate(
    { _id: "partialInvoicingNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seqNumber = counter.seq.toString().padStart(6, "0");
  // Using INVX to differentiate from the main "invoiceNum"
  return `2025-26-INVX-${seqNumber}`;
}

async function generatePaymentId() {
  const counter = await SalesOrderCounterModel.findByIdAndUpdate(
    { _id: "paymentNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seqNumber = counter.seq.toString().padStart(6, "0");
  // Using INVX to differentiate from the main "invoiceNum"
  return `2025-26-PAYV-${seqNumber}`;
}

// Pre-save hook to generate order number
salesOrderSchema1C1I.pre("save", async function (next) {
  const doc = this;

  if (!doc.isNew) {
    return next();
  }

  try {
    // Populate salesAddress and currency from customer's address and currency if not already set
    if (!doc.salesAddress || !doc.currency) {
      // Fetch the customer document to get the address and currency
      const customer = await mongoose
        .model("Customers")
        .findById(doc.customer)
        .select("address currency");

      if (!customer) {
        throw new Error(`Customer with ID ${doc.customer} not found.`);
      }

      if (!customer.address) {
        throw new Error(
          `Customer with ID ${doc.customer} does not have an address.`
        );
      }

      if (!customer.currency) {
        throw new Error(
          `Customer with ID ${doc.customer} does not have a currency set.`
        );
      }

      if (!doc.salesAddress) {
        doc.salesAddress = customer.address;
      }

      if (!doc.currency) {
        doc.currency = customer.currency;
      }
    }

    // Calculate Computed Fields
    const initialAmt = doc.quantity * doc.price;
    const discountAmt =
      Math.round(((doc.discount * initialAmt) / 100) * 100) / 100;
    const taxAmount =
      Math.round(
        ((doc.tax * (doc.quantity * doc.price - discountAmt + doc.charges)) /
          100) *
          100
      ) / 100;
    const withholdingTaxAmt =
      Math.round(
        ((doc.withholdingTax *
          (doc.quantity * doc.price - discountAmt + doc.charges)) /
          100) *
          100
      ) / 100;
    const netAmtAfterTax =
      Math.round(
        (doc.quantity * doc.price - discountAmt + doc.charges + taxAmount) * 100
      ) / 100;
    const netAR = Math.round((netAmtAfterTax + withholdingTaxAmt) * 100) / 100;
    // Compute total paid using the virtual (or inline reduction)
    // const totalPaid =
    //   doc.paidAmt && doc.paidAmt.length
    //     ? doc.paidAmt.reduce((sum, val) => sum + val, 0)
    //     : 0;
    const totalPaid = doc.totalPaid; // using the virtual field
    const netPaymentDue =
      Math.round((netAR - totalPaid - this.advance) * 100) / 100;

    doc.discountAmt = discountAmt;
    doc.taxAmount = taxAmount;
    doc.withholdingTaxAmt = withholdingTaxAmt;
    doc.netAmtAfterTax = netAmtAfterTax;
    doc.netAR = netAR;
    doc.netPaymentDue = netPaymentDue;
    //doc.paidAmt = paidAmt;

    // Update settlement status based on current advance and totalPaid
    doc.updateSettlementStatus();

    // if (
    //   doc.status === "Invoiced" &&
    //   (!doc.invoiceNum || doc.invoiceNum === "NA")
    // ) {
    //   console.log("Generating invoice number (pre-save)...");
    //   doc.invoiceNum = await generateInvoiceNumber();
    //   console.log("New invoice number generated:", doc.invoiceNum);
    // }

    await doc.validate();

    const dbResponse = await SalesOrderCounterModel.findByIdAndUpdate(
      { _id: "salesOrderCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log("Counter increment result", dbResponse);

    if (!dbResponse || dbResponse.seq === undefined) {
      throw new Error("Failed to generate sales order number");
    }

    const seqNumber = dbResponse.seq.toString().padStart(6, "0");
    doc.orderNum = `SO_${seqNumber}`;

    // ================================
    // Check for newly added sub-docs
    // ================================
    // shippingQty
    if (doc.isModified("shippingQty") && doc.shippingQty) {
      for (const shipping of doc.shippingQty) {
        if (!shipping.shipmentId) {
          shipping.shipmentId = await generateShipmentId();
        }
      }
    }
    // deliveringQty
    if (doc.isModified("deliveringQty") && doc.deliveringQty) {
      for (const delivery of doc.deliveringQty) {
        if (!delivery.deliveryId) {
          delivery.deliveryId = await generateDeliveryId();
        }
      }
    }
    // invoicingQty
    if (doc.isModified("invoicingQty") && doc.invoicingQty) {
      for (const inv of doc.invoicingQty) {
        if (!inv.invoicingId) {
          inv.invoicingId = await generateInvoicingId();
        }
      }
    }

    // paidAmt
    if (doc.isModified("paidAmt") && doc.paidAmt) {
      for (const paym of doc.paidAmt) {
        if (!paym.paymentId) {
          paym.paymentId = await generatePaymentId();
        }
      }
    }

    next();
  } catch (error) {
    console.log("Error caught during SO presave", error.stack);
    next(error);
  }
});

// Populate References on Find

salesOrderSchema1C1I.pre(/^find/, function (next) {
  this.populate(
    "customer",
    "code name contactNum address currency registrationNum panNum active"
  ).populate("item", "code name price type unit");
  next();
});

// Calculate Line Amount Automatically
salesOrderSchema1C1I.pre("validate", function (next) {
  const initialAmt = this.quantity * this.price;
  const discountAmt = Math.round(this.discount * initialAmt) / 100;
  this.lineAmt = this.quantity * this.price - discountAmt + this.charges;
  next();
});

salesOrderSchema1C1I.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  // Extract newStatus from either update.status or update.$set.status
  //const newStatus = update.status || (update.$set && update.$set.status);

  try {
    // Validate existence of the customer
    if (update.customer) {
      const customerExists = await mongoose
        .model("Customers")
        .findById(update.customer);
      if (!customerExists) {
        throw new Error(`Customer with ID ${update.customer} does not exist.`);
      }
    }

    // Validate existence of the item
    if (update.item) {
      const itemExists = await mongoose.model("Items").findById(update.item);
      if (!itemExists) {
        throw new Error(`Item with ID ${update.item} does not exist.`);
      }
    }

    // Recalculate computed fields if relevant fields are being updated
    if (
      update.quantity ||
      update.price ||
      update.discount ||
      update.charges ||
      update.tax ||
      update.withholdingTax ||
      update.advance
    ) {
      // Fetch the existing document to get current values if not provided in the update
      const docToUpdate = await this.model.findOne(this.getQuery());

      const quantity = update.quantity || docToUpdate.quantity || 1;
      const price = update.price || docToUpdate.price || 0;
      const discount = update.discount || docToUpdate.discount || 0;
      const charges = update.charges || docToUpdate.charges || 0;
      const tax = update.tax || docToUpdate.tax || 0;
      const withholdingTax =
        update.withholdingTax || docToUpdate.withholdingTax || 0;
      const advance = update.advance || docToUpdate.advance || 0;

      const initialAmt = quantity * price;
      const discountAmt =
        Math.round(((discount * initialAmt) / 100) * 100) / 100;
      const lineAmt =
        Math.round((quantity * price - discountAmt + charges) * 100) / 100;
      const taxAmount = Math.round(((tax * lineAmt) / 100) * 100) / 100;
      const withholdingTaxAmt =
        Math.round(((withholdingTax * lineAmt) / 100) * 100) / 100;
      const netAmtAfterTax = Math.round((lineAmt + taxAmount) * 100) / 100;
      const netAR =
        Math.round(
          (netAmtAfterTax + (withholdingTax * initialAmt) / 100) * 100
        ) / 100;
      // Use the existing paidAmt array from the document
      const totalPaid =
        docToUpdate.paidAmt && docToUpdate.paidAmt.length
          ? docToUpdate.paidAmt.reduce((sum, val) => sum + val.amount, 0)
          : 0;
      const netPaymentDue =
        Math.round((netAR - totalPaid - advance) * 100) / 100;

      update.lineAmt = lineAmt;
      update.discountAmt = discountAmt;
      update.taxAmount = taxAmount;
      update.withholdingTaxAmt = withholdingTaxAmt;
      update.netAmtAfterTax = netAmtAfterTax;
      update.netAR = netAR;
      update.netPaymentDue = netPaymentDue;
      //update.paidAmt = paidAmt;
    }

    // // If the update sets status to "Invoiced", generate a new invoice number.
    // if (newStatus === "Invoiced") {
    //   console.log("Generating invoice number (findOneAndUpdate)...");
    //   if (update.$set) {
    //     update.$set.invoiceNum = await generateInvoiceNumber();
    //   } else {
    //     update.invoiceNum = await generateInvoiceNumber();
    //   }
    // }

    // Handle status reversion to Draft on modifications
    const fieldsBeingUpdated = [
      "orderType",
      "customer",
      "item",
      "salesAddress",
      "advance",
      "quantity",
      "price",
      "currency",
      "discount",
      "charges",
      "tax",
      "withholdingTax",
      "settlementStatus",
      "archived",
      "createdBy",
      "updatedBy",
      "active",
      "files",
    ];

    const isModifying = fieldsBeingUpdated.some((field) => field in update);

    if (isModifying) {
      // Set status back to Draft
      update.status = "Draft";
    }

    // -------------- NEW LOGIC --------------
    // If user is pushing a new subdocument in shippingQty, deliveringQty, or invoicingQty
    // we generate an ID for each newly added subdocument if it doesn't have one.
    if (update.shippingQty) {
      // The user might be using $push or $set. We need to handle carefully:
      // If it's $push: { shippingQty: { <newObj> } } or $push: { shippingQty: { $each: [] } }
      // If it's $set: { shippingQty: [...] } (the entire array is replaced)
      // We'll handle it generically by fetching the final array from the DB doc after the update merges,
      // then assigning IDs if missing.
      // The simplest approach: run the update, then in post hook we do the final assignment.
      // But Mongoose doesn't do post('findOneAndUpdate') the same way as pre('save').
      // So we do it in pre, but we can't see the final array yet. We'll do a small workaround:

      // We'll parse the new elements from update. If it's $push => we see update.$push?.shippingQty
      // If it's $set => we see update.$set?.shippingQty or update.shippingQty
      // For brevity, let's just handle the typical $push scenario:

      if (update.$push && update.$push.shippingQty) {
        const newShp = update.$push.shippingQty;
        // If it's $each array
        if (newShp.$each) {
          for (const s of newShp.$each) {
            if (!s.shipmentId) {
              s.shipmentId = await generateShipmentId();
            }
          }
        } else {
          // single item
          if (!newShp.shipmentId) {
            newShp.shipmentId = await generateShipmentId();
          }
        }
      } else if (Array.isArray(update.shippingQty)) {
        // entire array replaced
        for (const s of update.shippingQty) {
          if (!s.shipmentId) {
            s.shipmentId = await generateShipmentId();
          }
        }
      }
    }

    if (update.deliveringQty) {
      if (update.$push && update.$push.deliveringQty) {
        const newDlv = update.$push.deliveringQty;
        if (newDlv.$each) {
          for (const d of newDlv.$each) {
            if (!d.deliveryId) {
              d.deliveryId = await generateDeliveryId();
            }
          }
        } else {
          if (!newDlv.deliveryId) {
            newDlv.deliveryId = await generateDeliveryId();
          }
        }
      } else if (Array.isArray(update.deliveringQty)) {
        for (const d of update.deliveringQty) {
          if (!d.deliveryId) {
            d.deliveryId = await generateDeliveryId();
          }
        }
      }
    }

    if (update.invoicingQty) {
      if (update.$push && update.$push.invoicingQty) {
        const newInv = update.$push.invoicingQty;
        if (newInv.$each) {
          for (const i of newInv.$each) {
            if (!i.invoicingId) {
              i.invoicingId = await generateInvoicingId();
            }
          }
        } else {
          if (!newInv.invoicingId) {
            newInv.invoicingId = await generateInvoicingId();
          }
        }
      } else if (Array.isArray(update.invoicingQty)) {
        for (const i of update.invoicingQty) {
          if (!i.invoicingId) {
            i.invoicingId = await generateInvoicingId();
          }
        }
      }
    }

    if (update.paidAmt) {
      if (update.$push && update.$push.paidAmt) {
        const newPay = update.$push.paidAmt;
        if (newPay.$each) {
          for (const p of newPay.$each) {
            if (!p.paymentId) {
              p.paymentId = await generatePaymentId();
            }
          }
        } else {
          if (!newPay.paymentId) {
            newPay.paymentId = await generatePaymentId();
          }
        }
      } else if (Array.isArray(update.paidAmt)) {
        for (const p of update.paidAmt) {
          if (!p.paymentId) {
            p.paymentId = await generatePaymentId();
          }
        }
      }
    }
    // ---------------------------------------

    next();
  } catch (error) {
    next(error); // Pass error to the next middleware/controller
  }
});

salesOrderSchema1C1I.index({ orderNum: 1, customer: 1, item: 1 });

export const SalesOrderModel =
  mongoose.models.SalesOrders || model("SalesOrders", salesOrderSchema1C1I);
