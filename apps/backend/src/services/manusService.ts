import type { ManusAnalysisResult } from "../types";

/**
 * Manus AI Service
 *
 * Analyses complaint text for sentiment, severity and suggested reply.
 *
 * If MANUS_API_KEY is set, uses the real Manus API.
 * Otherwise, returns a mock analysis based on simple keyword heuristics.
 *
 * TODO: Replace mock implementation with real Manus API calls.
 * Manus docs: https://docs.manus.app (TODO: confirm URL with team)
 */
export async function analyseComplaint(
  customerMessage: string,
  businessContext: string
): Promise<ManusAnalysisResult> {
  if (process.env.MANUS_API_KEY) {
    return callManusApi(customerMessage, businessContext);
  }
  return mockAnalysis(customerMessage);
}

async function callManusApi(
  customerMessage: string,
  businessContext: string
): Promise<ManusAnalysisResult> {
  // TODO: Implement real Manus API call
  // const response = await fetch("https://api.manus.app/v1/analyse", {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${process.env.MANUS_API_KEY}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({ message: customerMessage, context: businessContext }),
  // });
  // const data = await response.json();
  // return mapManusResponse(data);
  throw new Error("Manus API integration not yet implemented");
}

function mockAnalysis(message: string): ManusAnalysisResult {
  const lower = message.toLowerCase();

  const hostileWords = ["furious", "disgusting", "never again", "sue", "legal", "solicitor", "court"];
  const negativeWords = ["unhappy", "disappointed", "wrong", "broken", "damaged", "missing", "refund", "angry", "terrible", "awful"];
  const positiveWords = ["thank", "great", "love", "amazing", "excellent"];

  const isHostile = hostileWords.some((w) => lower.includes(w));
  const isNegative = negativeWords.some((w) => lower.includes(w));
  const isPositive = positiveWords.some((w) => lower.includes(w));

  let sentiment: ManusAnalysisResult["sentiment"] = "neutral";
  let severityScore = 3;

  if (isHostile) {
    sentiment = "hostile";
    severityScore = 8;
  } else if (isNegative) {
    sentiment = "negative";
    severityScore = 5;
  } else if (isPositive) {
    sentiment = "positive";
    severityScore = 2;
  }

  const suggestedSeverity: ManusAnalysisResult["suggested_severity"] =
    severityScore >= 7 ? "high" : severityScore >= 4 ? "medium" : "low";

  return {
    sentiment,
    severity_score: severityScore,
    suggested_severity: suggestedSeverity,
    key_topics: extractKeyTopics(lower),
    suggested_reply: buildSuggestedReply(sentiment),
    escalate: severityScore >= 7,
  };
}

function extractKeyTopics(lower: string): string[] {
  const topics = [];
  if (lower.includes("refund")) topics.push("refund");
  if (lower.includes("delivery") || lower.includes("late")) topics.push("delivery");
  if (lower.includes("quality") || lower.includes("wrong") || lower.includes("damaged")) topics.push("product_quality");
  if (lower.includes("allergy") || lower.includes("ill") || lower.includes("sick")) topics.push("health_safety");
  if (lower.includes("legal") || lower.includes("sue") || lower.includes("court")) topics.push("legal_threat");
  return topics;
}

function buildSuggestedReply(sentiment: ManusAnalysisResult["sentiment"]): string {
  if (sentiment === "hostile") {
    return "We sincerely apologise for your experience. A member of our team will contact you personally within 2 hours to resolve this matter.";
  }
  if (sentiment === "negative") {
    return "We're very sorry to hear you've had a problem. Could you please share a few more details so we can put things right for you?";
  }
  return "Thank you for getting in touch. We'd love to help — could you share more details about what happened?";
}
