import type { Intent } from "@orderpilot/shared";
import {
  ORDER_KEYWORDS,
  COMPLAINT_KEYWORDS,
  HUMAN_HANDOVER_KEYWORDS,
} from "@orderpilot/shared";

export interface RoutingDecision {
  intent: Intent;
  confidence: number;
}

/**
 * Router Agent
 *
 * Classifies an inbound WhatsApp message into one of:
 *   order | complaint | product_question | human_handover | unknown
 *
 * Uses keyword scoring. Each matching keyword adds 1 point.
 * The intent with the highest score wins (minimum threshold: 1 point).
 *
 * TODO: Replace keyword scoring with an LLM classifier for better accuracy.
 */
export function routeMessage(message: string): RoutingDecision {
  const lower = message.toLowerCase();

  const scores: Record<Intent, number> = {
    order: 0,
    complaint: 0,
    product_question: 0,
    human_handover: 0,
    unknown: 0,
  };

  for (const kw of ORDER_KEYWORDS) {
    if (lower.includes(kw)) scores.order++;
  }

  for (const kw of COMPLAINT_KEYWORDS) {
    if (lower.includes(kw)) scores.complaint++;
  }

  for (const kw of HUMAN_HANDOVER_KEYWORDS) {
    if (lower.includes(kw)) scores.human_handover++;
  }

  // Detect product questions (price, menu, availability queries)
  const questionKeywords = ["what", "how much", "do you have", "available", "menu", "price", "cost", "how long", "when"];
  for (const kw of questionKeywords) {
    if (lower.includes(kw)) scores.product_question++;
  }

  // If message contains complaint signals AND order signals, complaint wins
  if (scores.complaint > 0 && scores.order > 0) {
    scores.order = 0;
  }

  const topIntent = (Object.entries(scores) as [Intent, number][])
    .filter(([k]) => k !== "unknown")
    .sort(([, a], [, b]) => b - a)[0];

  if (!topIntent || topIntent[1] === 0) {
    return { intent: "unknown", confidence: 0 };
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? topIntent[1] / total : 0;

  return { intent: topIntent[0], confidence: Math.round(confidence * 100) / 100 };
}
