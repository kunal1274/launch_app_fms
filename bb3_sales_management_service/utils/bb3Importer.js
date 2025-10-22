import fs from 'node:fs';
import csv from 'fast-csv';
import ExcelJS from 'exceljs';
import { SalesOrderModel } from '../models/bb3SalesOrder.model.js';

export async function importCSV(filePath) {
  return new Promise((resolve, reject) => {
    const orders = [];
    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true }))
      .on('error', reject)
      .on('data', (row) => orders.push(row))
      .on('end', async () => {
        await SalesOrderModel.insertMany(orders, { ordered: false });
        resolve(orders.length);
      });
  });
}

export async function importXLSX(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(1);
  const rows = [];
  ws.eachRow((r, idx) => {
    if (idx === 1) return; // header
    rows.push({
      orderNum: r.getCell(1).value,
      customer: r.getCell(2).value,
      netAmtAfterTax: r.getCell(3).value,
      status: r.getCell(4).value,
      createdAt: r.getCell(5).value,
    });
  });
  await SalesOrderModel.insertMany(rows, { ordered: false });
  return rows.length;
}
