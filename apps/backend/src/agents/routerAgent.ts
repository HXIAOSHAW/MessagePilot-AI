import type { Intent } from "@orderpilot/shared";
import {
  ORDER_KEYWORDS,
  COMPLAINT_KEYWORDS,
  HUMAN_HANDOVER_KEYWORDS,
  RISKY_ORDER_SIGNALS,
} from "@orderpilot/shared";

export interface RoutingDecision {
  intent: Intent;
  confidence: number;
  reason: string;
}

// ─── Product question markers ─────────────────────────────────────────────────

const PRODUCT_QUESTION_SIGNALS = [
  "how much",
  "what does",
  "what is the price",
  "what's the price",
  "how long",
  "do you do",
  "do you have",
  "do you make",
  "do you sell",
  "is it available",
  "what flavours",
  "what options",
  "what sizes",
  "can i see",
  "your menu",
  "your prices",
];

// ─── Order intent markers — phrases that strongly signal purchase intent ──────

const STRONG_ORDER_SIGNALS = [
  "i want to order",
  "i'd like to order",
  "i would like to order",
  "can i order",
  "place an order",
  "i want to buy",
  "can i buy",
  "i'd like to buy",
  "i need to order",
  "i want to get",
  "can i get",
  "i'd like a",
  "i would like a",
  "please can i have",
  "can i have",
  "i'll take",
  "for pickup",
  "for delivery",
  "for friday",
  "for saturday",
  "for sunday",
  "for monday",
  "for tuesday",
  "for wednesday",
  "for thursday",
  "for tomorrow",
  "for today",
];

/**
 * Router Agent
 *
 * Classifies an inbound WhatsApp message using a priority-ordered rule chain:
 *
 *   1. Risky signals   → complaint (or human_handover for explicit asks)
 *   2. Human handover  → human_handover
 *   3. Complaint       → complaint
 *   4. Strong order    → order (high confidence)
 *   5. Weak order      → order (lower confidence)
 *   6. Product Q       → product_question
 *   7. Ambiguous       → unknown (ask for clarification)
 *
 * Risky signals always beat order signals — a complaint that mentions
 * a product name must never be processed as an order.
 *
 * TODO: Replace rule chain with an LLM classifier for production.
 */
export function routeMessage(message: string): RoutingDecision {
  const lower = message.toLowerCase().trim();

  // ── 1. Risky signals — route away from order pipeline immediately ──────────
  //    Use word-boundary matching so short tokens don't match inside other words.

  const riskHits = RISKY_ORDER_SIGNALS.filter((s) =>
    new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)
  );
  if (riskHits.length > 0) {
    // Check if they also want to speak to a human
    const handoverHit = HUMAN_HANDOVER_KEYWORDS.find((k) => lower.includes(k));
    if (handoverHit) {
      return {
        intent: "human_handover",
        confidence: 0.95,
        reason: `Risky signal "${riskHits[0]}" + human handover request "${handoverHit}"`,
      };
    }
    return {
      intent: "complaint",
      confidence: 0.9,
      reason: `Risky signal(s) detected: ${riskHits.slice(0, 3).join(", ")}`,
    };
  }

  // ── 2. Explicit human handover request ────────────────────────────────────

  const handoverHit = HUMAN_HANDOVER_KEYWORDS.find((k) => lower.includes(k));
  if (handoverHit) {
    return {
      intent: "human_handover",
      confidence: 0.95,
      reason: `Human handover keyword: "${handoverHit}"`,
    };
  }

  // ── 3. Complaint keywords (word-boundary match to avoid e.g. "ill" in "vanilla") ──

  const complaintHits = COMPLAINT_KEYWORDS.filter((k) =>
    new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)
  );
  if (complaintHits.length >= 2) {
    return {
      intent: "complaint",
      confidence: Math.min(0.5 + complaintHits.length * 0.1, 0.95),
      reason: `Complaint keywords: ${complaintHits.slice(0, 3).join(", ")}`,
    };
  }

  // ── 4. Product question — must be checked before weak order signals ──────
  //    "how much is the vanilla cake?" should be product_question, not order.
  //    Only treat as product_question if there are no STRONG order signals.

  const questionHit = PRODUCT_QUESTION_SIGNALS.find((s) => lower.includes(s));
  const strongHits = STRONG_ORDER_SIGNALS.filter((s) => lower.includes(s));

  if (questionHit && strongHits.length === 0) {
    return {
      intent: "product_question",
      confidence: 0.85,
      reason: `Question signal: "${questionHit}", no strong order intent`,
    };
  }

  // ── 5. Strong order signals ───────────────────────────────────────────────

  if (strongHits.length > 0) {
    return {
      intent: "order",
      confidence: Math.min(0.7 + strongHits.length * 0.08, 0.97),
      reason: `Strong order signal(s): ${strongHits.slice(0, 2).join(", ")}`,
    };
  }

  // ── 6. Weak order signals (product words + intent words) ──────────────────

  const weakOrderHits = ORDER_KEYWORDS.filter((k) => lower.includes(k));
  const hasProductWord = ["cake", "cupcake", "vanilla", "chocolate", "birthday", "box"].some(
    (p) => lower.includes(p)
  );
  const hasIntentWord = ["want", "order", "buy", "get", "need", "like"].some(
    (w) => lower.includes(w)
  );

  if (weakOrderHits.length >= 2 && hasProductWord && hasIntentWord) {
    return {
      intent: "order",
      confidence: 0.6,
      reason: `Order keywords (${weakOrderHits.slice(0, 2).join(", ")}) + product word`,
    };
  }

  // ── 7. Single complaint keyword (possibly ambiguous) ──────────────────────

  if (complaintHits.length === 1) {
    return {
      intent: "complaint",
      confidence: 0.5,
      reason: `Single complaint keyword: "${complaintHits[0]}"`,
    };
  }

  // ── 8. Ambiguous — product mentioned but no clear intent ──────────────────

  if (hasProductWord || questionHit) {
    return {
      intent: "unknown",
      confidence: 0.3,
      reason: "Product mentioned but intent unclear — ask for clarification",
    };
  }

  return {
    intent: "unknown",
    confidence: 0,
    reason: "No recognisable intent signals",
  };
}
