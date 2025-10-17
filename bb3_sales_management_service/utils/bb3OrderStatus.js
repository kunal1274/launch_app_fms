/* sum only rows that are Posted (i.e. officially recognised) */
const posted = (arr) =>
  arr
    ?.filter((r) => r.status === "Posted")
    .reduce((n, r) => n + Number(r.qty || 0), 0) || 0;

/**
 * Decide the *overall* order status from posted qty totals.
 * returned value is one of the extended statuses in STATUS_TRANSITIONS.
 */
export function computeStatus({ ordered, shipped, delivered, invoiced }) {
  if (shipped === 0) return "Confirmed";
  if (shipped === ordered) return "Shipped";
  if (shipped < ordered && delivered === 0) return "PartiallyShipped"; // no delivery but some shipment
  if (shipped < ordered && delivered === shipped && invoiced === 0)
    return "Delivered";
  if (shipped < ordered && delivered < shipped && invoiced === 0)
    return "PartiallyDelivered"; // no invoicing
  if (shipped < ordered && delivered < shipped && invoiced < delivered)
    return "PartiallyInvoiced";
  if (delivered === 0) return "Shipped";
  if (delivered < ordered) return "PartiallyDelivered";
  if (invoiced === 0) return "Delivered";
  if (invoiced < ordered) return "PartiallyInvoiced";
  return "Invoiced";
}

/* Convenience – get all four numbers from a sales‑order doc */
export function totals(so) {
  return {
    ordered: so.quantity,
    shipped: posted(so.shippingQty),
    delivered: posted(so.deliveringQty),
    invoiced: posted(so.invoicingQty),
  };
}
