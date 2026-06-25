/**
 * Complaint severity classifier (deterministic fallback).
 *
 * Used when Manus is unavailable (no key / timeout / error). Applies a keyword
 * heuristic plus the same business-rule overrides Manus is instructed to follow,
 * so the pipeline behaves consistently with or without the model.
 */

import type { ComplaintSeverity, DraftOrder } from "@orderpilot/shared";
import { SAFETY_BLOCKED_TOPICS } from "@orderpilot/shared";
import { config } from "../config";

export interface SeverityResult {
  severity: ComplaintSeverity;
  risk_flags: string[];
  reasoning: string;
}

const HIGH_TRIGGER_FLAGS = new Set([
  "angry_tone",
  "legal_threat",
  "repeated_complaint",
  "high_value_order",
  "health_safety",
  "public_review_threat",
]);

/**
 * Classify complaint severity using keyword heuristics + business rules.
 */
export async function classifySeverity(
  complaintText: string,
  order: DraftOrder | null = null
): Promise<SeverityResult> {
  const base = heuristicClassify(complaintText);

  let { severity } = base;
  const riskFlags = [...base.risk_flags];

  if (order && order.total_gbp >= config.HIGH_VALUE_ORDER_GBP) {
    if (!riskFlags.includes("high_value_order")) riskFlags.push("high_value_order");
    severity = "high";
  }

  if (riskFlags.some((flag) => HIGH_TRIGGER_FLAGS.has(flag))) {
    severity = "high";
  }

  if (riskFlags.includes("refund_request") && order && order.total_gbp > config.AUTO_REFUND_MAX_GBP) {
    severity = "high";
  }

  return { severity, risk_flags: riskFlags, reasoning: base.reasoning };
}

function heuristicClassify(complaintText: string): SeverityResult {
  const lower = complaintText.toLowerCase();
  const flags: string[] = [];
  const has = (words: string[]) => words.some((w) => lower.includes(w));

  if (has(["refund", "money back"])) flags.push("refund_request");
  if (has(["furious", "angry", "disgusting", "disgusted", "livid", "unacceptable", "appalling"]))
    flags.push("angry_tone");
  if (has(["legal", "solicitor", "lawyer", "court", "sue", "trading standards", "chargeback"]))
    flags.push("legal_threat");
  if (has(["again", "second time", "still not", "keeps happening"])) flags.push("repeated_complaint");
  if (
    SAFETY_BLOCKED_TOPICS.some((t) => lower.includes(t)) ||
    has(["allergy", "allergic", "sick", "ill", "hospital", "injured", "food poisoning", "fire", "smoke", "electrical"])
  )
    flags.push("health_safety");
  if (has(["review", "social media", "facebook", "instagram", "tell everyone", "post about"]))
    flags.push("public_review_threat");
  if (has(["wrong item", "wrong order", "not what i ordered", "incorrect"])) flags.push("wrong_item");
  if (has(["late", "delivery", "never arrived", "didn't arrive", "did not arrive"]))
    flags.push("delivery_issue");

  let severity: ComplaintSeverity = "low";
  if (flags.some((f) => HIGH_TRIGGER_FLAGS.has(f))) severity = "high";
  else if (flags.length > 0) severity = "medium";

  return { severity, risk_flags: flags, reasoning: "Heuristic classification (Manus unavailable)." };
}
