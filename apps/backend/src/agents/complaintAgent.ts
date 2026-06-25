import { v4 as uuidv4 } from "uuid";
import type { AgentContext, AgentResult, ComplaintCase, ComplaintSeverity } from "@orderpilot/shared";
import { SAFETY_BLOCKED_TOPICS, DEFAULT_OWNER_ESCALATION_MESSAGE } from "@orderpilot/shared";
import { analyseComplaint } from "../services/manusService";
import { createOwnerTask } from "../services/ownerTaskService";
import { saveComplaintCase } from "../db/repositories";
import { runSafetyCheck } from "./safetyAgent";

/**
 * Complaint Agent
 *
 * Handles customer complaints by:
 * 1. Extracting issue, order reference, urgency, evidence, desired outcome
 * 2. Classifying severity (low / medium / high)
 * 3. Applying safety rules — NEVER auto-approves refunds, legal, health/safety
 * 4. Calling ManusService for AI analysis (mock if no API key)
 * 5. Escalating high-risk cases to owner tasks
 * 6. Returning a safe, empathetic customer reply
 */
export async function runComplaintAgent(ctx: AgentContext): Promise<AgentResult> {
  const { message, customer_name, customer_phone, business_id, conversation_id } = ctx;

  // ── 1. Extract complaint details ─────────────────────────────────────────

  const orderRef = extractOrderRef(message);
  const desiredOutcome = extractDesiredOutcome(message);
  const evidence = extractEvidence(message);
  const urgency = extractUrgency(message);

  // ── 2. AI analysis (Manus or mock) ───────────────────────────────────────

  const analysis = await analyseComplaint(message, `Business: ${business_id}`);

  // ── 3. Determine severity ─────────────────────────────────────────────────

  const severity = determineSeverity(message, analysis.suggested_severity);

  // ── 4. Safety check ───────────────────────────────────────────────────────

  const safetyResult = runSafetyCheck(message, analysis.suggested_reply);
  const requiresEscalation = severity === "high" || safetyResult.blockedTopics.length > 0 || analysis.escalate;

  // ── 5. Build safe reply ───────────────────────────────────────────────────

  const safeReply = requiresEscalation
    ? DEFAULT_OWNER_ESCALATION_MESSAGE
    : buildSafeReply(customer_name, severity, analysis.suggested_reply);

  // ── 6. Create complaint case ──────────────────────────────────────────────

  const complaint: ComplaintCase = {
    id: uuidv4(),
    business_id,
    customer_phone,
    customer_name,
    issue_summary: summariseIssue(message),
    order_reference: orderRef,
    urgency,
    evidence,
    desired_outcome: desiredOutcome,
    severity,
    safe_reply: safeReply,
    requires_escalation: requiresEscalation,
    created_at: new Date().toISOString(),
  };

  await saveComplaintCase(complaint);

  // ── 7. Escalate to owner if needed ────────────────────────────────────────

  let ownerTask = undefined;

  if (requiresEscalation) {
    ownerTask = await createOwnerTask({
      business_id,
      type: "complaint_escalation",
      title: `[${severity.toUpperCase()}] Complaint from ${customer_name}`,
      description:
        `Customer: ${customer_phone}\n` +
        `Issue: ${complaint.issue_summary}\n` +
        `Desired outcome: ${desiredOutcome}\n` +
        `Safety flags: ${safetyResult.blockedTopics.join(", ") || "none"}\n` +
        `Original message: "${message}"`,
      priority: severity === "high" ? "urgent" : "high",
      related_order_id: null,
      related_complaint_id: complaint.id,
    });
  }

  return {
    intent: "complaint",
    reply: safeReply,
    complaint,
    owner_task: ownerTask,
  };
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

function extractOrderRef(message: string): string | null {
  const match = message.match(/order\s*(?:number|ref|reference|#|id)?\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  return match ? match[1] : null;
}

function extractDesiredOutcome(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("refund")) return "full refund";
  if (lower.includes("replacement") || lower.includes("replace")) return "replacement";
  if (lower.includes("compensation") || lower.includes("compensate")) return "compensation";
  if (lower.includes("apology") || lower.includes("sorry")) return "apology";
  return "resolution";
}

function extractEvidence(message: string): string[] {
  const evidence: string[] = [];
  if (/photo|picture|image|screenshot/i.test(message)) evidence.push("photo_attached");
  if (/receipt|invoice/i.test(message)) evidence.push("receipt_mentioned");
  if (/witness|saw|seen/i.test(message)) evidence.push("witness_mentioned");
  return evidence;
}

function extractUrgency(message: string): "low" | "medium" | "high" {
  const lower = message.toLowerCase();
  const highUrgencyWords = ["urgent", "asap", "immediately", "now", "emergency", "today", "right now", "hospital", "sick", "ill", "injured"];
  const mediumUrgencyWords = ["soon", "quickly", "as soon as possible", "this week"];

  if (highUrgencyWords.some((w) => lower.includes(w))) return "high";
  if (mediumUrgencyWords.some((w) => lower.includes(w))) return "medium";
  return "low";
}

function determineSeverity(message: string, aiSuggested: ComplaintSeverity): ComplaintSeverity {
  const lower = message.toLowerCase();

  // Force high severity for blocked topics
  const hasBlockedTopic = SAFETY_BLOCKED_TOPICS.some((t) => lower.includes(t));
  if (hasBlockedTopic) return "high";

  const hostileWords = ["furious", "disgusting", "never again", "sue", "legal", "solicitor", "court", "trading standards"];
  if (hostileWords.some((w) => lower.includes(w))) return "high";

  return aiSuggested;
}

function summariseIssue(message: string): string {
  // Return first 200 chars as a clean summary
  return message.length > 200 ? message.substring(0, 197) + "..." : message;
}

function buildSafeReply(
  name: string,
  severity: ComplaintSeverity,
  aiSuggested: string
): string {
  if (severity === "medium") {
    return (
      `Hi ${name}, thank you for letting us know. We're very sorry to hear about your experience — ` +
      `this is not the standard we hold ourselves to.\n\n` +
      `${aiSuggested}\n\n` +
      `We'll do our best to make this right for you.`
    );
  }

  return (
    `Hi ${name}, thank you for reaching out. We're sorry you've had a problem — we take all feedback seriously.\n\n` +
    `${aiSuggested}`
  );
}
