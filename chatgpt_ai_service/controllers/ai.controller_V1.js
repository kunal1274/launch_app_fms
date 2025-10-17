import callOpenAI from "../services/callOpenAi.js";
import { SalesOrderModel } from "../../models/salesorder.model.js";

/* POST /api/ai/query  ----------------------------------------------- */
export const chatQuery = async (req, res, next) => {
  try {
    const { question, userId, orderCode } = req.body;
    const recent = await SalesOrderModel.find({ code: orderCode })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const context = JSON.stringify(recent);
    const prompt = `You are an ERP assistant.If the question is about totals or anything related to sales orders compute them from context JSON.\nContext:\n${context}\n\nUser: ${question}`;
    const answer = await callOpenAI(prompt, 512);
    res.json({ response: answer });
  } catch (e) {
    next(e);
  }
};

/* GET /api/ai/insights/:id  ----------------------------------------- */
export const orderInsights = async (req, res, next) => {
  try {
    const so = await SalesOrderModel.findById(req.params.id).lean();
    const prompt = `
      Analyse this sales‑order JSON. 
      Return a short JSON: {summary, paymentRisk, profitMargin,outstandingShipments,outstandingDeliveries,shipmentBottlenecks,alerts}.
      Sales‑order:\n${JSON.stringify(so)}
    `;
    const answer = await callOpenAI(prompt, 256, "json");
    res.json(JSON.parse(answer));
  } catch (e) {
    next(e);
  }
};
