/**
 * Manus service — the complaint agent's reasoning engine.
 *
 * Uses the Manus v2 API (https://open.manus.ai/docs/v2). A complaint is sent as
 * a task with a `structured_output_schema`; Manus reasons about it and returns a
 * structured decision (severity, action, suggested reply). The backend then
 * executes the decided action through its own adapters, with hard guardrails.
 *
 * Manus tasks are asynchronous: we create the task, then poll task.listMessages
 * until the `structured_output_result` event arrives (or we time out).
 */

import type { AgentContext, DraftOrder, Product } from "@orderpilot/shared";
import { AUTO_REFUND_MAX_GBP } from "@orderpilot/shared";
import { config, hasManusKey } from "../config";
import type { ManusComplaintDecision } from "../types";

// ─── Structured output schema (strict subset required by Manus) ───────────────
// Every object must set additionalProperties:false and list all props in required.

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "string", enum: ["low", "medium", "high"] },
    risk_flags: { type: "array", items: { type: "string" } },
    action: { type: "string", enum: ["auto_resolve", "issue_refund", "escalate"] },
    refund_amount_gbp: {
      type: "number",
      description: "Refund amount in GBP. 0 if no refund is proposed.",
    },
    order_reference: { type: ["string", "null"] },
    reply_text: {
      type: "string",
      description: "The customer-facing WhatsApp reply (British English, empathetic).",
    },
    owner_summary: {
      type: "string",
      description: "A concise summary for the shop owner if escalating; empty string otherwise.",
    },
    reasoning: { type: "string" },
  },
  required: [
    "severity",
    "risk_flags",
    "action",
    "refund_amount_gbp",
    "order_reference",
    "reply_text",
    "owner_summary",
    "reasoning",
  ],
  additionalProperties: false,
} as const;

/**
 * Run a complaint through Manus and return a structured decision.
 * Returns null on missing key, timeout, or any failure (caller should fall back).
 */
export async function runManusComplaint(
  ctx: AgentContext,
  order: DraftOrder | null
): Promise<ManusComplaintDecision | null> {
  if (!hasManusKey()) return null;

  try {
    const prompt = buildComplaintPrompt(ctx, order);
    const taskId = await createTask(prompt);
    const result = await pollStructuredResult(taskId);
    if (!result || !result.success || !result.value) return null;
    return normaliseDecision(result.value);
  } catch (err) {
    console.warn("[manusService] complaint task failed:", (err as Error).message);
    return null;
  }
}

// ─── Low-level Manus API helpers ──────────────────────────────────────────────

interface ManusEnvelope {
  ok?: boolean;
  error?: { code?: string; message?: string };
  [key: string]: unknown;
}

async function manusFetch(path: string, init: RequestInit): Promise<ManusEnvelope> {
  const res = await fetch(`${config.MANUS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-manus-api-key": config.MANUS_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT_MS),
  });

  const body = (await res.json()) as ManusEnvelope;
  if (!res.ok || body.ok === false) {
    const code = body.error?.code ?? String(res.status);
    const message = body.error?.message ?? res.statusText;
    throw new Error(`Manus ${path} failed: ${code} — ${message}`);
  }
  return body;
}

async function createTask(content: string): Promise<string> {
  const body = await manusFetch("/v2/task.create", {
    method: "POST",
    body: JSON.stringify({
      message: { content },
      structured_output_schema: DECISION_SCHEMA,
      agent_profile: config.MANUS_AGENT_PROFILE,
      interactive_mode: false,
      hide_in_task_list: true,
    }),
  });

  const taskId = body.task_id as string | undefined;
  if (!taskId) throw new Error("Manus task.create returned no task_id");
  return taskId;
}

interface TaskEvent {
  type: string;
  status_update?: { agent_status?: "running" | "stopped" | "waiting" | "error" };
  error_message?: { content?: string };
  structured_output_result?: { success?: boolean; value?: unknown; error?: string | null };
}

async function pollStructuredResult(
  taskId: string
): Promise<{ success: boolean; value: unknown } | null> {
  const deadline = Date.now() + config.MANUS_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const body = await manusFetch(
      `/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=50`,
      { method: "GET" }
    );
    const messages = (body.messages as TaskEvent[] | undefined) ?? [];

    const structured = messages.find((m) => m.type === "structured_output_result");
    if (structured?.structured_output_result) {
      const r = structured.structured_output_result;
      return { success: Boolean(r.success), value: r.value };
    }

    const status = messages.find((m) => m.type === "status_update")?.status_update?.agent_status;
    if (status === "error") {
      const errMsg = messages.find((m) => m.type === "error_message")?.error_message?.content;
      throw new Error(`Manus task errored: ${errMsg ?? "unknown error"}`);
    }
    if (status === "waiting") {
      // interactive_mode:false should prevent this; bail so the caller escalates.
      return null;
    }

    await sleep(config.MANUS_POLL_INTERVAL_MS);
  }

  return null; // timed out
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Prompt + decision normalisation ──────────────────────────────────────────

function buildComplaintPrompt(ctx: AgentContext, order: DraftOrder | null): string {
  return `\
You are the Complaint agent for "${config.SHOP_NAME}", handling a customer problem received over WhatsApp. Be empathetic, accountable, and calm. Use British English. Do NOT browse the web or run code — decide using only the information below and respond directly.

${formatCatalog(ctx.catalog)}

Customer name: ${ctx.customer_name}
Customer phone: ${ctx.customer_phone}
${order ? `Linked order: ${JSON.stringify(order)}` : "No order found for this customer."}
${ctx.image_url ? `Customer attached an image: ${ctx.image_url}` : "No image attached."}

Customer's message:
"""
${ctx.message}
"""

Decide how to handle this complaint and return the structured result:
- "severity": low | medium | high.
- "risk_flags": e.g. refund_request, high_value_order, angry_tone, legal_threat, health_safety, public_review_threat, wrong_item, delivery_issue, minor_cosmetic.
- "action":
  * "issue_refund" ONLY when severity is low, a refund is warranted, and the amount is at or below the auto-refund limit of £${AUTO_REFUND_MAX_GBP}. Set "refund_amount_gbp" accordingly and a linked order must exist.
  * "auto_resolve" for low-risk issues you can resolve with an apology/explanation and no refund.
  * "escalate" for ANY medium/high-risk case, large refund, legal/health/safety concern, or when unsure. Set "owner_summary".
- "reply_text": the message to send the customer. If escalating, reassure them their case is being passed to the team WITHOUT promising a refund, replacement, compensation, or admitting fault.
- Never autonomously approve large refunds, accept legal liability, or make safety guarantees. When in doubt, escalate.`;
}

function formatCatalog(catalog: Product[]): string {
  if (!catalog || catalog.length === 0) return "";
  const lines = catalog.map((p) => `- ${p.name} (£${p.price_gbp.toFixed(2)})`).join("\n");
  return `Products we sell:\n${lines}\n`;
}

function normaliseDecision(value: unknown): ManusComplaintDecision {
  const v = (value ?? {}) as Record<string, unknown>;
  const severity = (["low", "medium", "high"] as const).includes(v.severity as never)
    ? (v.severity as ManusComplaintDecision["severity"])
    : "medium";
  const action = (["auto_resolve", "issue_refund", "escalate"] as const).includes(v.action as never)
    ? (v.action as ManusComplaintDecision["action"])
    : "escalate";

  return {
    severity,
    risk_flags: Array.isArray(v.risk_flags) ? (v.risk_flags as string[]) : [],
    action,
    refund_amount_gbp: typeof v.refund_amount_gbp === "number" ? v.refund_amount_gbp : 0,
    order_reference: typeof v.order_reference === "string" ? v.order_reference : null,
    reply_text: typeof v.reply_text === "string" ? v.reply_text : "",
    owner_summary: typeof v.owner_summary === "string" ? v.owner_summary : "",
    reasoning: typeof v.reasoning === "string" ? v.reasoning : "",
  };
}
