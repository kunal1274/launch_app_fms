import { SalesOrderModel } from "../../models/salesorder.model.js";
import callOpenAI from "../services/callOpenAi.js";

/* helper to always emit KPIs even if the LLM forgets one */
function ensureKpis(obj) {
  const keys = [
    "summary",
    "paymentRisk",
    "profitMargin",
    "outstandingShipments",
    "outstandingDeliveries",
    "shipmentBottlenecks",
    "alerts",
    "otherRisks",
    "mitigationRecommendations",
    "timelines",
  ];
  keys.forEach((k) => {
    if (!(k in obj)) obj[k] = "—";
  });
  return obj;
}

/* POST  /api/ai/query  */
export const chatQuery = async (req, res, next) => {
  try {
    const { question, orderNum = "" } = req.body;

    // try to load the single SO first
    let contextDocs = [];
    if (orderNum) {
      contextDocs = await SalesOrderModel.find({ orderNum }).limit(1).lean();
    }
    if (!contextDocs.length) {
      // fallback – last 20
      contextDocs = await SalesOrderModel.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    }

    const prompt = `You are an expert ERP assistant.
Always answer ONLY from the JSON context. If answer is not found, say "I don't have that information".
Context:\n${JSON.stringify(contextDocs)}\n\nUser: ${question}`;

    const answer = await callOpenAI(prompt, 512);
    res.json({ response: answer });
  } catch (e) {
    next(e);
  }
};

/* GET /api/ai/insights/:id */
export const orderInsights = async (req, res, next) => {
  const { soid } = req.params;
  //console.log(`soid ${soid}`);
  try {
    const so = await SalesOrderModel.findById(soid);
    //console.log(`so${so.orderNum}`);
    //return res.status(200).send({ data: so });

    const prompt = `
    Return a JSON with exactly these keys:
    summary,paymentRisk,profitMargin,outstandingShipments,outstandingDeliveries,shipmentBottlenecks,alerts,otherRisks,mitigationRecommendations,timelines.
    Tailor them to this sales‑order:\n${JSON.stringify(so)}
    `;
    //console.log(prompt);
    const answer = await callOpenAI(prompt, 1024, "json");
    // console.log(
    //   `answer is ${answer}, and parsed json is : ${JSON.parse(answer)}`
    // );
    res.json(ensureKpis(JSON.parse(answer)));
  } catch (e) {
    next(e);
  }
};

// this is one sample answer of insights ..
/**
 * {
    "summary": {
        "orderNum": "SO_000023",
        "customer": "Moto Industries Limited",
        "totalAmount": 2286,
        "amountPaid": 330,
        "amountDue": 1956,
        "status": "Invoiced",
        "paymentTerms": "Net30D"
    },
    "paymentRisk": {
        "riskLevel": "Medium",
        "comments": "Partial payment received; remaining amount due within 30 days."
    },
    "profitMargin": {
        "grossProfit": 1956,
        "profitMarginPercentage": 85.7
    },
    "outstandingShipments": [
        {
            "shipmentId": "2025-26-SHP-000014",
            "quantity": 7,
            "status": "Draft"
        },
        {
            "shipmentId": "2025-26-SHP-000015",
            "quantity": 2,
            "status": "Draft"
        }
    ],
    "outstandingDeliveries": [
        {
            "deliveryId": "2025-26-DLV-000027",
            "quantity": 4,
            "status": "Draft"
        },
        {
            "deliveryId": "2025-26-DLV-000028",
            "quantity": 5,
            "status": "Draft"
        }
    ],
    "shipmentBottlenecks": {
        "issues": "All shipments are currently in draft status, indicating potential delays in processing."
    },
    "alerts": [
        {
            "alertType": "Payment Alert",
            "message": "Partial payment received; follow up for remaining balance."
        },
        {
            "alertType": "Delivery Alert",
            "message": "Outstanding deliveries need to be processed."
        }
    ],
    "otherRisks": {
        "riskFactors": [
            "Customer's payment history",
            "Current economic conditions"
        ]
    },
    "mitigationRecommendations": [
        "Follow up with the customer regarding the outstanding payment.",
        "Ensure timely processing of shipments and deliveries."
    ],
    "timelines": {
        "paymentDueDate": "2025-05-19T10:46:05.869Z",
        "expectedDeliveryDate": "2025-04-19T00:00:00.000Z"
    }
}
 * 
 */
