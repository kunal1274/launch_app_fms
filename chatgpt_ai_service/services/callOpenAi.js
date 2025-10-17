import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY_SUNITARATXEN });

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

export default async function callOpenAI(
  prompt,
  maxTokens = 256,
  format = "text"
) {
  const { choices } = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.2,
    ...(format === "json" && { response_format: { type: "json_object" } }),
  });
  return choices[0].message.content.trim();
}
