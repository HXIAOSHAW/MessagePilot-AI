/**
 * Manus AI Service
 *
 * Two integration points:
 *
 * 1. Complaint agent reasoning — `runManusComplaint(ctx, order)`
 *    Sends the complaint + order context to Manus v2 and gets back a
 *    structured decision (severity / action / reply). Falls back to a
 *    deterministic flow when the key is missing or the task times out.
 *    Backend guardrails always re-validate before any refund/escalation.
 *
 * 2. Route-level intent classification — `getManusAdapter()`
 *    MANUS_MODE=external → calls real Manus for intent + order extraction.
 *    MANUS_MODE=mock (default) → returns null; route uses local Router Agent.
 *    Fallback to Router Agent on any external failure (manus_fallback=true).
 *
 * API docs: https://open.manus.ai/docs/v2
 */

import type { AgentContext, DraftOrder, Product } from "@orderpilot/shared";
import { AUTO_REFUND_MAX_GBP, EMPTY_EXTRACTED_ORDER } from "@orderpilot/shared";
import { config, hasManusKey } from "../config";
import type { ManusComplaintDecision } from "../types";
import type { ManusAdapter, ManusDecision, ManusMessageContext } from "../adapters/manusAdapter";
import { MockManusAdapter } from "../adapters/mockManusAdapter";
import type { ExtractedOrder } from "@orderpilot/shared";

// ─── Route-level Manus adapter factory ────────────────────────────────────────

let _adapter: ManusAdapter | null | undefined = undefined;

/**
 * Returns ManusAdapter for route-level intent classification, or null when
 * MANUS_MODE=mock (route uses local Router Agent directly).
 */
export function getManusAdapter(): ManusAdapter | null {
  if (_adapter !== undefined) return _adapter;

  const mode = process.env.MANUS_MODE ?? "mock";

  if (mode === "external") {
    const apiKey = config.MANUS_API_KEY;
    if (!apiKey) {
      console.warn("[ManusService] MANUS_MODE=external but MANUS_API_KEY is not set — using mock");
      _adapter = null;
      return null;
    }
    _adapter = new ManusTaskAdapter();
    console.info(`[ManusService] Route Manus: external at ${config.MANUS_BASE_URL} (${config.MANUS_AGENT_PROFILE})`);
    return _adapter;
  }

  _adapter = null;
  return null;
}

export function resetManusAdapter(): void {
  _adapter = undefined;
}

// ─── Route-level Manus Task Adapter ───────────────────────────────────────────

class ManusTaskAdapter implements ManusAdapter {
  async analyseMessage(message: string, context: ManusMessageContext): Promise<ManusDecision> {
    const prompt = buildOrderAnalysisPrompt(message, context);

    console.info("[ManusTask] Creating intent-classification task...");
    const taskId = await createTask(prompt, ROUTE_INTENT_SCHEMA);
    console.info(`[ManusTask] Task created: ${taskId}`);

    const result = await pollStructuredResult(taskId, 10_000);
    if (!result || !result.success || !result.value) {
      throw new Error("Manus task timed out or returned no structured result");
    }

    console.info(`[ManusTask] Got result: intent=${(result.value as any)?.intent}`);
    return flatValueToManusDecision(result.value);
  }
}

// ─── Complaint agent reasoning ─────────────────────────────────────────────────

/**
 * Run a complaint through Manus and return a structured decision.
 * Returns null when key is missing, task times out, or any failure occurs.
 * The caller (complaintAgent) must fall back to deterministic flow on null.
 */
export async function runManusComplaint(
  ctx: AgentContext,
  order: DraftOrder | null
): Promise<ManusComplaintDecision | null> {
  if (!hasManusKey()) return null;

  try {
    const prompt = buildComplaintPrompt(ctx, order);
    const taskId = await createTask(prompt, COMPLAINT_DECISION_SCHEMA);
    const result = await pollStructuredResult(taskId);
    if (!result || !result.success || !result.value) return null;
    return normaliseDecision(result.value);
  } catch (err) {
    console.warn("[ManusService] complaint task failed:", (err as Error).message);
    return null;
  }
}

// ─── Shared Manus v2 HTTP helpers ─────────────────────────────────────────────

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

async function createTask(content: string, schema: object): Promise<string> {
  const body = await manusFetch("/v2/task.create", {
    method: "POST",
    body: JSON.stringify({
      message: { content },
      structured_output_schema: schema,
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
  taskId: string,
  timeoutMs?: number
): Promise<{ success: boolean; value: unknown } | null> {
  const timeout = timeoutMs ?? config.MANUS_POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeout;
  // Give the task a moment to be indexed before first poll
  await sleep(config.MANUS_POLL_INTERVAL_MS);

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
    if (status === "waiting") return null;

    await sleep(config.MANUS_POLL_INTERVAL_MS);
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Complaint schema + prompt ─────────────────────────────────────────────────

const COMPLAINT_DECISION_SCHEMA = {
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
    "severity", "risk_flags", "action", "refund_amount_gbp",
    "order_reference", "reply_text", "owner_summary", "reasoning",
  ],
  additionalProperties: false,
} as const;

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

// ─── Route-level intent schema + prompt ───────────────────────────────────────

const ROUTE_INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["order", "complaint", "product_question", "human_handover", "unknown"],
    },
    confidence: { type: "number" },
    action: {
      type: "string",
      enum: [
        "create_draft_order", "ask_missing_order_details", "answer_product_question",
        "create_complaint", "escalate_to_owner", "ask_clarifying_question", "human_handover",
      ],
    },
    product_name: { type: ["string", "null"] },
    matched_catalog_product_id: { type: ["string", "null"] },
    quantity: { type: ["number", "null"] },
    fulfillment_method: { type: "string", enum: ["pickup", "delivery", "unknown"] },
    requested_date: { type: ["string", "null"] },
    requested_time: { type: ["string", "null"] },
    customer_notes: { type: ["string", "null"] },
    missing_fields: { type: "array", items: { type: "string" } },
    safety_flags: { type: "array", items: { type: "string" } },
    requires_human: { type: "boolean" },
    reply_text: { type: "string" },
    reason: { type: "string" },
  },
  required: [
    "intent", "confidence", "action",
    "product_name", "matched_catalog_product_id", "quantity",
    "fulfillment_method", "requested_date", "requested_time", "customer_notes",
    "missing_fields", "safety_flags", "requires_human", "reply_text", "reason",
  ],
  additionalProperties: false,
} as const;

function buildOrderAnalysisPrompt(message: string, context: ManusMessageContext): string {
  const productList = context.catalog
    .filter((p) => p.available)
    .map((p) => `  - ${(p as any).id ?? p.name}: ${p.name} £${p.price_gbp} — ${p.description}`)
    .join("\n");

  return `You are a customer service AI for ${context.business_id} (${config.SHOP_NAME}).

Analyze the following WhatsApp message and determine the customer's intent, extract order details if applicable, and draft a friendly reply.

Customer name: ${context.customer_name}
Customer message: "${message}"

Available products:
${productList}

Rules:
- Classify intent: order, complaint, product_question, human_handover, or unknown
- For orders: extract product, quantity, date, fulfillment method (pickup or delivery)
- Set missing_fields to any required missing fields (product_name, requested_date, fulfillment_method, quantity)
- Flag safety_flags for: refund requests, legal threats, angry/hostile language, food safety concerns
- If safety_flags is non-empty, set requires_human=true and use complaint or human_handover intent
- DO NOT promise refunds or legal actions in reply_text
- reply_text should be warm, friendly, and professional
- matched_catalog_product_id: set to the product id from the catalog if matchable, else null

Respond with the structured output only.`;
}

function flatValueToManusDecision(v: any): ManusDecision {
  const extracted: ExtractedOrder = {
    product_name: v.product_name ?? null,
    matched_catalog_product_id: v.matched_catalog_product_id ?? null,
    quantity: v.quantity ?? null,
    fulfillment_method: v.fulfillment_method ?? "unknown",
    requested_date: v.requested_date ?? null,
    requested_time: v.requested_time ?? null,
    customer_notes: v.customer_notes ?? null,
  };

  return {
    intent: v.intent ?? "unknown",
    confidence: typeof v.confidence === "number" ? v.confidence : 0.5,
    action: v.action ?? "ask_clarifying_question",
    extracted_order: extracted,
    missing_fields: Array.isArray(v.missing_fields) ? v.missing_fields : [],
    safety_flags: Array.isArray(v.safety_flags) ? v.safety_flags : [],
    requires_human: Boolean(v.requires_human),
    reply_text: v.reply_text ?? "",
    reason: v.reason ?? "manus-external",
  };
}

// Re-export adapter type for routes
export type { ManusAdapter } from "../adapters/manusAdapter";
