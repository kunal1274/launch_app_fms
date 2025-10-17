# Sales Management Module

**Version:** 1.1.0  
**Last Updated:** $(date)  
**Status:** Implemented - Needs Standardization  

## Overview

The Sales Management module handles the complete sales lifecycle from order creation to payment processing. It integrates with the Inventory Management module for stock updates and the General Ledger module for financial transactions.

## Architecture

### Components
- **Model:** `salesorder.model.js` - Data schema and business logic
- **Controller:** `salesorder.controller.js` - API endpoint handlers
- **Routes:** `salesorder.routes.js` - HTTP route definitions
- **Service:** `salesStock.service.js` - Business logic services
- **Validator:** `salesorder.validator.js` - Input validation (to be created)

### Dependencies
- **Customer Model:** For customer information and validation
- **Item Model:** For product details and pricing
- **Inventory Service:** For stock updates
- **General Ledger:** For financial transaction recording

## Data Model

### Sales Order Schema
```javascript
{
  orderNum: String,              // Auto-generated: SO_000001
  orderType: String,             // "Sales" | "Return"
  invoiceNum: String,            // Generated invoice number
  invoiceDate: Date,             // Invoice date
  dueDate: Date,                 // Payment due date
  customer: ObjectId,            // Reference to Customers
  item: ObjectId,                // Reference to Items
  salesAddress: String,          // Delivery address
  remarks: String,               // Additional notes
  advance: Number,               // Advance payment amount
  quantity: Number,              // Ordered quantity
  price: Number,                 // Unit price
  costPrice: Number,             // Cost price
  purchPrice: Number,            // Purchase price
  currency: String,              // "INR" | "USD" | "EUR" | "GBP"
  exchangeRate: Number,          // Currency exchange rate
  charges: Number,               // Additional charges
  discount: Number,              // Discount percentage
  tax: Number,                   // Tax percentage
  withholdingTax: Number,        // Withholding tax percentage
  lineAmt: Number,               // Calculated line amount
  taxAmount: Number,             // Calculated tax amount
  discountAmt: Number,           // Calculated discount amount
  withholdingTaxAmt: Number,     // Calculated withholding tax
  netAmtAfterTax: Number,        // Amount after tax
  netAR: Number,                 // Net accounts receivable
  netPaymentDue: Number,         // Outstanding payment
  paymentTerms: String,          // "COD" | "Net7D" | "Net15D" | etc.
  paidAmt: [PaymentObject],      // Payment history
  carryForwardAdvance: Number,   // Excess advance amount
  status: String,                // Order status
  settlementStatus: String,      // Payment status
  archived: Boolean,             // Archive flag
  company: ObjectId,             // Company reference
  groups: [ObjectId],            // Group references
  createdBy: String,             // Creator user
  updatedBy: String,             // Last updater
  active: Boolean,               // Active flag
  files: [FileObject],           // Attached files
  extras: Map,                   // Custom fields
  timestamps: true               // createdAt, updatedAt
}
```

### Status Transitions
```javascript
const STATUS_TRANSITIONS = {
  Draft: ["Confirmed", "Cancelled", "AdminMode", "AnyMode"],
  Confirmed: ["Draft", "Confirmed", "Cancelled", "Invoiced", "AdminMode", "AnyMode"],
  Invoiced: ["AdminMode", "AnyMode"],
  Cancelled: ["AdminMode", "AnyMode"],
  AdminMode: ["Draft", "AnyMode"],
  AnyMode: ["Draft", "Confirmed", "Invoiced", "Cancelled", "AdminMode"]
};
```

### Settlement Status
```javascript
const SETTLEMENT_STATUS = {
  PAYMENT_PENDING: "No payment received",
  PAYMENT_PARTIAL: "Partial payment received",
  PAYMENT_FULL: "Full payment received",
  PAYMENT_FAILED: "Payment failed",
  PAYMENT_FULL_CARRY_FORWARD_ADVANCE: "Overpaid with advance carry forward"
};
```

## API Endpoints

### Sales Orders
```http
GET    /api/v0/salesorders           # List all sales orders
GET    /api/v0/salesorders/:id       # Get sales order by ID
POST   /api/v0/salesorders           # Create new sales order
PUT    /api/v0/salesorders/:id       # Update sales order
PATCH  /api/v0/salesorders/:id       # Partial update
DELETE /api/v0/salesorders/:id       # Delete sales order
```

### Status Management
```http
PATCH  /api/v0/salesorders/:id/status    # Change order status
PATCH  /api/v0/salesorders/:id/archive   # Archive order
PATCH  /api/v0/salesorders/:id/unarchive # Unarchive order
```

### Payment Management
```http
POST   /api/v0/salesorders/:id/payment   # Add payment
GET    /api/v0/salesorders/:id/payments  # Get payment history
```

### Invoice Management
```http
PATCH  /api/v0/salesorders/:id/generate-invoice  # Generate invoice
```

### Bulk Operations
```http
DELETE /api/v0/salesorders/bulk-delete   # Delete multiple orders
DELETE /api/v0/salesorders/drafts        # Delete draft orders
```

## Business Logic

### Order Creation
1. **Validation:** Validate customer and item existence
2. **Address Population:** Auto-populate address from customer
3. **Currency Setting:** Set currency from customer default
4. **Calculation:** Calculate line amounts, taxes, and totals
5. **Number Generation:** Generate unique order number
6. **Status Setting:** Set initial status to "Draft"

### Status Updates
1. **Validation:** Check valid status transitions
2. **Business Rules:** Apply business logic based on status
3. **Inventory Update:** Update stock levels (if applicable)
4. **Financial Recording:** Record GL transactions (if applicable)
5. **Notification:** Send notifications (if configured)

### Payment Processing
1. **Validation:** Validate payment amount and method
2. **Calculation:** Update settlement status
3. **Recording:** Record payment in paidAmt array
4. **GL Integration:** Create GL entries for payment
5. **Status Update:** Update order status if fully paid

### Invoice Generation
1. **Validation:** Ensure order is in correct status
2. **Number Generation:** Generate unique invoice number
3. **Status Update:** Update order status to "Invoiced"
4. **GL Integration:** Create GL entries for invoice
5. **Document Generation:** Generate invoice document (if configured)

## Integration Points

### Inventory Management
- **Stock Updates:** Update inventory levels on order confirmation
- **Reservation:** Reserve stock for confirmed orders
- **Tracking:** Track item movements through sales process

### General Ledger
- **AR Transactions:** Create accounts receivable entries
- **Payment Recording:** Record payment transactions
- **Tax Handling:** Handle tax and withholding tax entries

### Customer Management
- **Customer Validation:** Ensure customer exists and is active
- **Address Management:** Use customer default address
- **Payment Terms:** Apply customer payment terms

## Error Handling

### Common Errors
- **ValidationError:** Invalid input data
- **NotFoundError:** Customer or item not found
- **StatusTransitionError:** Invalid status change
- **PaymentError:** Payment processing failed
- **DuplicateError:** Duplicate order number

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific error message"
    }
  ],
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

## Testing

### Unit Tests
- Model validation and business logic
- Service layer functions
- Utility functions

### Integration Tests
- API endpoint testing
- Database integration
- External service integration

### Test Data
```javascript
const testSalesOrder = {
  customer: "customer_id_here",
  item: "item_id_here",
  quantity: 10,
  price: 100.00,
  currency: "INR",
  paymentTerms: "Net30D"
};
```

## Performance Considerations

### Database Optimization
- **Indexes:** Order number, customer, status, date fields
- **Queries:** Use projection for list views
- **Aggregation:** Use aggregation for reports

### Caching Strategy
- **Customer Data:** Cache frequently accessed customer information
- **Item Data:** Cache item details and pricing
- **Status Lists:** Cache status transition rules

## Security

### Access Control
- **Authentication:** JWT token validation
- **Authorization:** Role-based access control
- **Data Isolation:** Company-based data separation

### Data Validation
- **Input Sanitization:** Prevent XSS and injection attacks
- **Schema Validation:** Validate all input data
- **Business Rules:** Enforce business logic constraints

## Monitoring and Logging

### Logging
- **Order Creation:** Log all order creation attempts
- **Status Changes:** Log status transitions
- **Payment Processing:** Log payment activities
- **Errors:** Log all errors with context

### Metrics
- **Order Volume:** Track orders per day/month
- **Payment Processing:** Monitor payment success rates
- **Error Rates:** Track error frequencies
- **Performance:** Monitor response times

## Future Enhancements

### Planned Features
- **Approval Workflow:** Multi-level approval process
- **Customer Portal:** Self-service customer interface
- **Automated Invoicing:** Auto-generate invoices
- **Reporting:** Advanced reporting and analytics

### Integration Opportunities
- **CRM Systems:** Integration with customer relationship management
- **Payment Gateways:** Direct payment processing
- **Document Management:** Advanced document handling
- **Notifications:** Email and SMS notifications

## Troubleshooting

### Common Issues
1. **Order Number Duplication:** Check counter collection
2. **Status Transition Errors:** Verify status transition rules
3. **Payment Calculation Errors:** Check calculation logic
4. **Customer Validation Failures:** Verify customer data integrity

### Debug Steps
1. Check application logs
2. Verify database constraints
3. Test with sample data
4. Check external service connectivity

---

**Module Maintainer:** Development Team  
**Last Review:** $(date)  
**Next Review:** TBD