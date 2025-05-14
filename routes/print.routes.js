import { Router } from "express";
import puppeteer from "puppeteer";

import { render } from "../print/compileTemplates.js";
import { SalesOrderModel } from "../models/salesorder.model.js";
import { CompanyModel } from "../models/company.model.js";

const r = Router();

/* GET /sales-orders/:id/print/invoice-classic */
r.get("/:id/print/invoice-classic", async (req, res, next) => {
  console.log("before printing");
  try {
    const order = await SalesOrderModel.findById(req.params.id)
      .populate("customer")
      .populate("item");
    if (!order) return res.status(404).send("Not found");

    const company = await CompanyModel.findOne({ active: true });

    console.log("printing try", order, company);

    // 1) render HTML with Handlebars
    const html = render("invoice-classic", { order, company });

    // 2) headless‑chrome → pdf
    const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=${order.orderNum}.pdf`,
      "Content-Length": pdfBuf.length,
    });
    return res.send(pdfBuf);
  } catch (e) {
    next(e);
  }
});

export default r;
