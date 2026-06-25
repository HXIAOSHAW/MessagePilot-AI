/**
 * Complaint Agent — Manus-powered.
 *
 * Manus is the reasoning engine (replacing the previous Haiku/Sonnet calls): it
 * receives the complaint + order context and returns a structured decision
 * (severity, action, suggested reply). The backend then EXECUTES that decision
 * through its own adapters with hard guardrails, so the model can never:
 *   - approve a refund above the auto-refund limit,
 *   - auto-resolve a medium/high-risk case, or
 *   - refund an order that doesn't exist / can't be looked up.
 *
 * The public signature is unchanged: runComplaintAgent(ctx) -> AgentResult, so
 * the route and the rest of the pipeline are untouched.
 *
 * If Manus is unavailable (no key / timeout / error), a deterministic fallback
 * classifies severity, escalates when needed, and records the case — so the demo
 * works against the in-memory mock store with no external calls.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  AgentContext,
  AgentResult,
  ComplaintCase,
  ComplaintSeverity,
  ComplaintStatus,
  DraftOrder,
  OwnerTask,
} from "@orderpilot/shared";
import { AUTO_REFUND_MAX_GBP, DEFAULT_OWNER_ESCALATION_MESSAGE } from "@orderpilot/shared";
import { config } from "../config";
import { runManusComplaint } from "../services/manusService";
import { classifySeverity } from "../services/severityService";
import { createOwnerTask } from "../services/ownerTaskService";
import { getPaymentAdapter } from "../adapters/paymentAdapter";
import { getMessagingAdapter } from "../adapters/messagingAdapter";
import { getLatestOrderByPhone, saveComplaintCase, saveEvent } from "../db/repositories";
import type { ManusComplaintDecision } from "../types";

interface RunState {
  recordedComplaint: ComplaintCase | null;
  ownerTask?: OwnerTask;
  requiresEscalation: boolean;
  lastSeverity: ComplaintSeverity;
  lastRiskFlags: string[];
  lastOrder: DraftOrder | null;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runComplaintAgent(ctx: AgentContext): Promise<AgentResult> {
  const state: RunState = {
    recordedComplaint: null,
    requiresEscalation: false,
    lastSeverity: "low",
    lastRiskFlags: [],
    lastOrder: null,
  };

  await logEvent(ctx, "agent_start", `Complaint agent invoked for ${ctx.customer_phone}`);

  // Best-effort context fetch so Manus (or the fallback) can reason about the order.
  state.lastOrder = await safeLatestOrder(ctx.customer_phone);

  const decision = await runManusComplaint(ctx, state.lastOrder);
  const reply = decision
    ? await applyManusDecision(ctx, state, decision)
    : await runDeterministicFallback(ctx, state);

  // Guarantee a recorded complaint so the route always gets an id.
  if (!state.recordedComplaint) {
    state.recordedComplaint = await persistComplaint(ctx, state, {
      description: ctx.message,
      severity: state.lastSeverity,
      risk_flags: state.lastRiskFlags,
      proposed_resolution: reply,
      status: state.requiresEscalation ? "escalated" : "auto_resolved",
      order_id: state.lastOrder?.id ?? null,
      photo_url: ctx.image_url,
    });
  }

  state.recordedComplaint.requires_escalation =
    state.requiresEscalation || state.recordedComplaint.requires_escalation;

  return {
    intent: "complaint",
    reply,
    complaint: state.recordedComplaint,
    owner_task: state.ownerTask,
    conversation_state: state.requiresEscalation ? "escalated" : "complaint",
  };
}

// ─── Execute a Manus decision (with guardrails) ───────────────────────────────

async function applyManusDecision(
  ctx: AgentContext,
  state: RunState,
  decision: ManusComplaintDecision
): Promise<string> {
  state.lastSeverity = decision.severity;
  state.lastRiskFlags = decision.risk_flags;
  const order = state.lastOrder;

  // ── Guardrails: decide the FINAL action the backend will take ──────────────
  let finalAction = decision.action;

  // Never auto-handle anything that isn't low risk.
  if (decision.severity !== "low") finalAction = "escalate";

  // A refund is only allowed for a real order, a positive amount, within limit.
  if (finalAction === "issue_refund") {
    const amount = decision.refund_amount_gbp;
    const canRefund = Boolean(order?.id) && amount > 0 && amount <= AUTO_REFUND_MAX_GBP;
    if (!canRefund) finalAction = "escalate";
  }

  // ── Perform the refund if still permitted ──────────────────────────────────
  let refundIssued = false;
  if (finalAction === "issue_refund" && order) {
    try {
      const refund = await getPaymentAdapter().refund(
        order.id,
        decision.refund_amount_gbp,
        decision.reasoning || "Complaint resolution"
      );
      refundIssued = true;
      await logEvent(
        ctx,
        "refund",
        `Refund £${decision.refund_amount_gbp.toFixed(2)} (${refund.refund_id}) for order ${order.id}`,
        null,
        "action"
      );
    } catch (err) {
      console.warn("[complaintAgent] refund failed; escalating:", (err as Error).message);
      finalAction = "escalate";
    }
  }

  const status: ComplaintStatus = finalAction === "escalate" ? "escalated" : "auto_resolved";
  const proposedResolution =
    finalAction === "escalate"
      ? decision.owner_summary || `Escalated: ${decision.reasoning}`
      : refundIssued
        ? `Refund £${decision.refund_amount_gbp.toFixed(2)} issued.`
        : decision.reply_text;

  const complaint = await persistComplaint(ctx, state, {
    description: ctx.message,
    severity: decision.severity,
    risk_flags: decision.risk_flags,
    proposed_resolution: proposedResolution,
    status,
    order_id: order?.id ?? decision.order_reference,
    photo_url: ctx.image_url,
  });
  state.recordedComplaint = complaint;

  if (finalAction === "escalate") {
    await escalateToOwner(
      ctx,
      state,
      complaint.id,
      decision.owner_summary || `[${decision.severity}] ${complaint.issue_summary}`
    );
    // Use a guaranteed-safe reply rather than any model text that may over-promise.
    return DEFAULT_OWNER_ESCALATION_MESSAGE;
  }

  return decision.reply_text || buildLowRiskReply(ctx.customer_name);
}

// ─── Deterministic fallback (Manus unavailable) ───────────────────────────────

async function runDeterministicFallback(ctx: AgentContext, state: RunState): Promise<string> {
  const severityResult = await classifySeverity(ctx.message, state.lastOrder);
  state.lastSeverity = severityResult.severity;
  state.lastRiskFlags = severityResult.risk_flags;

  const escalate = severityResult.severity !== "low";

  const complaint = await persistComplaint(ctx, state, {
    description: ctx.message,
    severity: severityResult.severity,
    risk_flags: severityResult.risk_flags,
    proposed_resolution: escalate ? "Escalated to owner for review." : "Acknowledged; team to follow up.",
    status: escalate ? "escalated" : "open",
    order_id: state.lastOrder?.id ?? null,
    photo_url: ctx.image_url,
  });
  state.recordedComplaint = complaint;

  if (escalate) {
    await escalateToOwner(ctx, state, complaint.id, `[${severityResult.severity}] ${complaint.issue_summary}`);
    return DEFAULT_OWNER_ESCALATION_MESSAGE;
  }

  return buildLowRiskReply(ctx.customer_name);
}

// ─── Infrastructure-backed helpers ────────────────────────────────────────────

interface ComplaintInput {
  description: string;
  severity: ComplaintSeverity;
  risk_flags: string[];
  proposed_resolution: string;
  status: ComplaintStatus;
  order_id: string | null;
  photo_url: string | null;
}

async function persistComplaint(
  ctx: AgentContext,
  _state: RunState,
  input: ComplaintInput
): Promise<ComplaintCase> {
  const evidence: string[] = [];
  if (input.photo_url) evidence.push("photo_attached");

  const complaint: ComplaintCase = {
    id: uuidv4(),
    business_id: ctx.business_id,
    customer_phone: ctx.customer_phone,
    customer_name: ctx.customer_name,
    issue_summary:
      input.description.length > 200 ? input.description.slice(0, 197) + "..." : input.description,
    order_reference: input.order_id,
    urgency: input.severity,
    evidence,
    desired_outcome: input.proposed_resolution,
    severity: input.severity,
    safe_reply: input.proposed_resolution,
    requires_escalation: input.status === "escalated",
    risk_flags: input.risk_flags,
    proposed_resolution: input.proposed_resolution,
    status: input.status,
    photo_url: input.photo_url,
    created_at: new Date().toISOString(),
  };

  await saveComplaintCase(complaint);
  await logEvent(
    ctx,
    "complaint_recorded",
    `Complaint recorded [${input.severity}] — ${complaint.issue_summary.slice(0, 80)}`,
    complaint.id,
    "action"
  );
  return complaint;
}

async function escalateToOwner(
  ctx: AgentContext,
  state: RunState,
  complaintId: string,
  reason: string
): Promise<OwnerTask> {
  const severity = state.lastSeverity;
  const task = await createOwnerTask({
    business_id: ctx.business_id,
    type: "complaint_escalation",
    title: `[${severity.toUpperCase()}] Complaint from ${ctx.customer_name}`,
    description:
      `Customer: ${ctx.customer_phone}\n` +
      `Complaint ref: ${complaintId}\n` +
      `Risk flags: ${state.lastRiskFlags.join(", ") || "none"}\n` +
      `Reason: ${reason}\n` +
      `Original message: "${ctx.message}"`,
    priority: severity === "high" ? "urgent" : "high",
    related_order_id: state.lastOrder?.id ?? null,
    related_complaint_id: complaintId,
  });

  state.ownerTask = task;
  state.requiresEscalation = true;

  if (config.OWNER_WHATSAPP) {
    getMessagingAdapter()
      .sendMessage(
        config.OWNER_WHATSAPP,
        `⚠️ Complaint escalated (#${complaintId.slice(0, 8)})\n\n${reason}\n\nPlease review in the dashboard.`
      )
      .catch((err) => console.warn("[complaintAgent] owner escalation message failed:", err));
  }

  await logEvent(ctx, "escalation", `Escalated complaint ${complaintId.slice(0, 8)} — ${reason}`, complaintId, "warn");
  return task;
}

async function safeLatestOrder(phone: string): Promise<DraftOrder | null> {
  try {
    return await getLatestOrderByPhone(phone);
  } catch (err) {
    console.warn("[complaintAgent] order lookup failed:", (err as Error).message);
    return null;
  }
}

function buildLowRiskReply(name: string): string {
  return (
    `Hi ${name}, thank you for reaching out and I'm sorry you've had a problem. ` +
    `We take all feedback seriously and a member of our team will be in touch shortly to put this right for you.`
  );
}

async function logEvent(
  ctx: AgentContext,
  kind: string,
  summary: string,
  ref: string | null = null,
  level: "info" | "warn" | "action" = "info"
): Promise<void> {
  try {
    await saveEvent({
      agent: "complaintAgent",
      kind,
      summary,
      level,
      ref,
      business_id: ctx.business_id,
      conversation_id: ctx.conversation_id,
      customer_phone: ctx.customer_phone,
    });
  } catch (err) {
    console.warn("[complaintAgent] failed to write event:", err);
  }
}
