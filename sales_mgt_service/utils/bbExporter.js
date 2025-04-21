import { pipeline } from "stream/promises";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

import { SalesOrderModel } from "../../models/salesorder.model.js";

/* stream CSV to res */
export async function streamCSV(res, filter = {}) {
  const cursor = SalesOrderModel.find(filter).lean().cursor();
  const transform = new Parser().transform; // json2csv stream
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="sales-orders.csv"'
  );
  await pipeline(cursor, transform, res);
}

/* stream XLSX to res */
export async function streamXLSX(res, filter = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SalesOrders");
  ws.columns = [
    { header: "Order #", key: "orderNum" },
    { header: "Customer", key: "customer.name" },
    { header: "Amount", key: "netAmtAfterTax" },
    { header: "Status", key: "status" },
    { header: "Created", key: "createdAt" },
  ];

  const cursor = SalesOrderModel.find(filter).lean().cursor();
  for await (const doc of cursor)
    ws.addRow({
      orderNum: doc.orderNum,
      "customer.name": doc.customer?.name ?? "",
      netAmtAfterTax: doc.netAmtAfterTax,
      status: doc.status,
      createdAt: doc.createdAt,
    });

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="sales-orders.xlsx"'
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  await wb.xlsx.write(res);
  res.end();
}
