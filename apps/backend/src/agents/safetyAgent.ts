import { SAFETY_BLOCKED_TOPICS } from "@orderpilot/shared";
import { DEFAULT_OWNER_ESCALATION_MESSAGE } from "@orderpilot/shared";

export interface SafetyCheckResult {
  safe: boolean;
  blockedTopics: string[];
  overrideReply: string | null;
}

/**
 * Safety Agent
 *
 * Scans any agent reply or customer message for topics that must NEVER
 * be handled automatically. Returns a safe override reply if triggered.
 *
 * Blocked categories:
 * - Refunds / compensation
 * - Legal threats
 * - Health and safety (allergies, food poisoning)
 * - Angry / hostile customers
 * - High-value complaints
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

  console.warn(`[SafetyAgent] Blocked topics detected: ${blockedTopics.join(", ")}`);

  return {
    safe: false,
    blockedTopics,
    overrideReply: DEFAULT_OWNER_ESCALATION_MESSAGE,
  };
}

/**
 * Check if a complaint reply should be blocked regardless of proposed reply.
 */
export function isHighRiskMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return SAFETY_BLOCKED_TOPICS.some((topic) => lower.includes(topic.toLowerCase()));
}
