import { SAFETY_BLOCKED_TOPICS, RISKY_ORDER_SIGNALS, DEFAULT_OWNER_ESCALATION_MESSAGE } from "@orderpilot/shared";

export interface SafetyCheckResult {
  safe: boolean;
  blockedTopics: string[];
  overrideReply: string | null;
}

export interface OrderSafetyResult {
  safe: boolean;
  safety_flags: string[];
  requires_human: boolean;
  reason: string | null;
}

/**
 * Full safety check for complaint replies.
 *
 * Scans the customer message AND the proposed reply for blocked topics.
 * Used by the Complaint Agent before sending any reply.
 */
export function runSafetyCheck(
  customerMessage: string,
  proposedReply: string
): SafetyCheckResult {
  const combined = `${customerMessage} ${proposedReply}`.toLowerCase();

  const blockedTopics = SAFETY_BLOCKED_TOPICS.filter((topic) =>
    combined.includes(topic.toLowerCase())
  );

  if (blockedTopics.length === 0) {
    return { safe: true, blockedTopics: [], overrideReply: null };
  }

  console.warn(`[SafetyAgent] Blocked topics in reply: ${blockedTopics.join(", ")}`);

  return {
    safe: false,
    blockedTopics,
    overrideReply: DEFAULT_OWNER_ESCALATION_MESSAGE,
  };
}

/**
 * Order-flow safety check.
 *
 * Runs on every inbound message *before* it reaches the Order Agent.
 * Catches messages that look like orders but contain complaint or risky signals
 * that must not be processed automatically.
 *
 * Rules:
 * - Risky signals (damaged, wrong item, refund, angry, allergy, legal, review threat)
 *   → not safe, requires human
 * - Blocked topics (health/safety, legal, compensation)
 *   → not safe, requires human
 * - Multiple complaint keywords
 *   → not safe, route to complaint agent
 * - Clean order with no risk signals
 *   → safe
 */
export function checkOrderSafety(message: string): OrderSafetyResult {
  const lower = message.toLowerCase();
  const flags: string[] = [];

  // Check risky order signals (word-boundary match to avoid false positives)
  const riskyHits = RISKY_ORDER_SIGNALS.filter((s) =>
    new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)
  );
  flags.push(...riskyHits);

  // Check safety-blocked topics
  const blockedHits = SAFETY_BLOCKED_TOPICS.filter((t) => lower.includes(t.toLowerCase()));
  for (const hit of blockedHits) {
    if (!flags.includes(hit)) flags.push(hit);
  }

  if (flags.length === 0) {
    return { safe: true, safety_flags: [], requires_human: false, reason: null };
  }

  const requiresHuman = blockedHits.some((t) =>
    ["legal", "solicitor", "lawyer", "court", "sue", "allergy", "allergic", "hospital", "food poisoning", "trading standards"].includes(t)
  ) || riskyHits.some((s) =>
    ["allergy", "allergic", "sick", "ill", "hospital", "injured", "food poisoning", "legal", "solicitor", "sue"].includes(s)
  );

  console.warn(`[SafetyAgent] Order safety flags: ${flags.slice(0, 4).join(", ")}`);

  return {
    safe: false,
    safety_flags: flags,
    requires_human: requiresHuman,
    reason: `Safety flag(s) detected: ${flags.slice(0, 3).join(", ")}`,
  };
}

/**
 * Quick check: does this message contain any risky signal?
 * Used by the route to determine whether to run Order Agent at all.
 */
export function isHighRiskMessage(message: string): boolean {
  const lower = message.toLowerCase();
  const wbMatch = (s: string) =>
    new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower);
  return (
    SAFETY_BLOCKED_TOPICS.some((t) => wbMatch(t)) ||
    RISKY_ORDER_SIGNALS.some((s) => wbMatch(s))
  );
}
