import type { ManusAnalysisResult } from "../types";
import type { ManusAdapter } from "../adapters/manusAdapter";
import { MockManusAdapter } from "../adapters/mockManusAdapter";

/**
 * Manus AI Service — Main Reasoning Agent
 *
 * Manus acts as the primary intelligence layer in the MessagePilot AI pipeline:
 *   - Intent classification (order / complaint / product_question / …)
 *   - Sentiment & severity analysis for complaints
 *   - Draft reply generation
 *
 * The Backend Safety Agent ALWAYS runs after Manus and has final authority.
 * No order is created, no checkout is issued, without Safety clearance.
 *
 * MANUS_MODE=mock (default)
 *   Local Router Agent handles intent; keyword heuristics handle sentiment.
 *   Safe for demos — no external credentials required.
 *
 * MANUS_MODE=external + MANUS_ENDPOINT set
 *   Calls teammate Manus endpoint. If it fails, falls back to mock and sets
 *   manus_fallback=true in the response.
 *
 * Teammate contract: see apps/backend/src/adapters/manusAdapter.ts
 */

// ─── Manus adapter factory ─────────────────────────────────────────────────────

let _adapter: ManusAdapter | null | undefined = undefined; // undefined = not yet resolved

/**
 * Returns the configured ManusAdapter, or null when MANUS_MODE=mock
 * (null means the route uses the local Router Agent directly — behaviour unchanged).
 *
 * MANUS_MODE=external requires MANUS_ENDPOINT to be set.
 * If MANUS_ENDPOINT is missing in external mode, falls back to mock with a warning.
 */
export function getManusAdapter(): ManusAdapter | null {
  if (_adapter !== undefined) return _adapter;

  const mode = process.env.MANUS_MODE ?? "mock";

  if (mode === "external") {
    const apiKey = process.env.MANUS_API_KEY ?? "";
    if (!apiKey) {
      console.warn("[ManusService] MANUS_MODE=external but MANUS_API_KEY is not set — using mock");
      _adapter = null;
      return null;
    }
    const baseUrl = process.env.MANUS_ENDPOINT || "https://api.manus.ai";
    _adapter = new ManusTaskAdapter(baseUrl, apiKey);
    console.info(`[ManusService] Using real Manus AI at ${baseUrl} (manus-1.6-lite)`);
    return _adapter;
  }

  // MANUS_MODE=mock (default) — return null; route will use Router Agent directly
  _adapter = null;
  return null;
}

/** Reset cached adapter (useful in tests). */
export function resetManusAdapter(): void {
  _adapter = undefined;
}

// ─── Types needed by ManusTaskAdapter ─────────────────────────────────────────

import type { ManusDecision, ManusMessageContext } from "../adapters/manusAdapter";
import { EMPTY_EXTRACTED_ORDER } from "@orderpilot/shared";
import type { ExtractedOrder } from "@orderpilot/shared";

// ─── Manus Task Adapter (real Manus API v2) ────────────────────────────────────

/**
 * ManusTaskAdapter — calls the real Manus AI API.
 *
 * Flow:
 *   1. POST /v2/task.create with structured_output_schema
 *   2. Poll /v2/task.listMessages every 2s until structured_output_result appears
 *   3. Parse the value into ManusDecision
 *   4. Throw on timeout (route falls back to mock Router Agent automatically)
 *
 * API docs: https://open.manus.ai/docs/v2/task.create
 */
class ManusTaskAdapter implements ManusAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async analyseMessage(message: string, context: ManusMessageContext): Promise<ManusDecision> {
    const prompt = buildAnalysisPrompt(message, context);

    console.info("[ManusTask] Creating task for message analysis...");
    const { task_id } = await this.createTask(prompt);
    console.info(`[ManusTask] Task created: ${task_id}`);

    const result = await this.pollForStructuredResult(task_id, 10_000);
    console.info(`[ManusTask] Got result for ${task_id}: intent=${result.intent}`);
    return result;
  }

  private async createTask(prompt: string): Promise<{ task_id: string }> {
    const res = await fetch(`${this.baseUrl}/v2/task.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": this.apiKey,
      },
      body: JSON.stringify({
        message: { content: prompt },
        agent_profile: "manus-1.6-lite",
        hide_in_task_list: true,
        structured_output_schema: MANUS_DECISION_SCHEMA,
      }),
    });

    const data = await res.json() as Record<string, any>;
    if (!data["ok"]) {
      throw new Error(`Manus task.create failed: ${data["error"]?.message ?? JSON.stringify(data)}`);
    }
    return { task_id: data["task_id"] as string };
  }

  private async pollForStructuredResult(
    taskId: string,
    timeoutMs: number
  ): Promise<ManusDecision> {
    const deadline = Date.now() + timeoutMs;
    // First poll: wait 3 s for the task to be indexed
    await sleep(3000);

    while (Date.now() < deadline) {
      await sleep(2000);
      const url = `${this.baseUrl}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=30`;
      const res = await fetch(url, {
        headers: { "x-manus-api-key": this.apiKey },
      });

      const data = await res.json() as Record<string, any>;
      if (!data["ok"]) {
        throw new Error(`Manus task.listMessages failed: ${data["error"]?.message}`);
      }

      const messages: any[] = data["messages"] ?? [];

      for (const msg of messages) {
        if (msg.type === "structured_output_result") {
          const sor = msg.structured_output_result;
          if (!sor.success) {
            throw new Error(`Manus structured output extraction failed: ${sor.error}`);
          }
          return flatValueToManusDecision(sor.value);
        }
        if (
          msg.type === "status_update" &&
          msg.status_update?.agent_status === "error"
        ) {
          throw new Error(
            `Manus task error: ${JSON.stringify(msg.status_update)}`
          );
        }
      }
    }

    throw new Error(`Manus task timed out after ${timeoutMs}ms`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Structured output schema ──────────────────────────────────────────────────

/**
 * JSON Schema for ManusDecision — must have all properties in `required`
 * and `additionalProperties: false` (Manus structured output requirement).
 * Nullable fields use `["string", "null"]` type array.
 */
const MANUS_DECISION_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["order", "complaint", "product_question", "human_handover", "unknown"],
      description: "The customer's intent",
    },
    confidence: {
      type: "number",
      description: "Confidence score 0.0-1.0",
    },
    action: {
      type: "string",
      enum: [
        "create_draft_order",
        "ask_missing_order_details",
        "answer_product_question",
        "create_complaint",
        "escalate_to_owner",
        "ask_clarifying_question",
        "human_handover",
      ],
      description: "Recommended backend action",
    },
    product_name: {
      type: ["string", "null"],
      description: "Product name if ordering",
    },
    matched_catalog_product_id: {
      type: ["string", "null"],
      description: "Matching product ID from the catalog",
    },
    quantity: {
      type: ["number", "null"],
      description: "Quantity ordered (null if not mentioned)",
    },
    fulfillment_method: {
      type: "string",
      enum: ["pickup", "delivery", "unknown"],
      description: "Pickup or delivery",
    },
    requested_date: {
      type: ["string", "null"],
      description: "Requested delivery/pickup date",
    },
    requested_time: {
      type: ["string", "null"],
      description: "Requested time, if mentioned",
    },
    customer_notes: {
      type: ["string", "null"],
      description: "Special notes from the customer",
    },
    missing_fields: {
      type: "array",
      items: { type: "string" },
      description: "Required order fields not yet provided",
    },
    safety_flags: {
      type: "array",
      items: { type: "string" },
      description: "Risky signals: angry language, refund demands, legal threats, health/food concerns",
    },
    requires_human: {
      type: "boolean",
      description: "True if a human must review",
    },
    reply_text: {
      type: "string",
      description: "Draft WhatsApp reply for the customer",
    },
    reason: {
      type: "string",
      description: "Explanation of routing decision",
    },
  },
  required: [
    "intent", "confidence", "action",
    "product_name", "matched_catalog_product_id", "quantity",
    "fulfillment_method", "requested_date", "requested_time", "customer_notes",
    "missing_fields", "safety_flags", "requires_human", "reply_text", "reason",
  ],
  additionalProperties: false,
} as const;

// ─── Prompt builder ────────────────────────────────────────────────────────────

function buildAnalysisPrompt(message: string, context: ManusMessageContext): string {
  const productList = context.catalog
    .filter((p) => p.available)
    .map((p) => `  - ${p.id ?? p.name}: ${p.name} £${p.price_gbp} — ${p.description}`)
    .join("\n");

  return `You are a customer service AI for a small bakery business (${context.business_id}).

Analyze the following WhatsApp message and determine the customer's intent, extract order details if applicable, and draft a friendly reply.

Customer name: ${context.customer_name}
Customer message: "${message}"

Available products:
${productList}

Rules:
- Classify intent as one of: order, complaint, product_question, human_handover, unknown
- For orders: extract product, quantity, date, fulfillment method (pickup or delivery)
- Set missing_fields to the list of required fields that are not present (product_name, requested_date, fulfillment_method, quantity)
- Flag safety_flags for: refund requests, legal threats, angry/hostile language, food safety concerns
- If safety_flags is non-empty, set requires_human=true and use complaint or human_handover intent
- DO NOT auto-promise refunds or legal actions in reply_text
- reply_text should be warm, friendly, and professional
- matched_catalog_product_id: set to the product id from the catalog if you can match the product, else null

Respond with the structured output only.`;
}

// ─── Result mapper ─────────────────────────────────────────────────────────────

/** Convert the flat structured output value into a ManusDecision. */
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

// Re-export for route use
export type { ManusAdapter } from "../adapters/manusAdapter";
export async function analyseComplaint(
  customerMessage: string,
  businessContext: string
): Promise<ManusAnalysisResult> {
  // Only call real Manus when explicitly in external mode with a key.
  // When MANUS_MODE=mock, always use keyword heuristics — safe for demos.
  if (process.env.MANUS_MODE === "external" && process.env.MANUS_API_KEY) {
    return callManusApi(customerMessage, businessContext);
  }
  return mockAnalysis(customerMessage);
}

async function callManusApi(
  customerMessage: string,
  _businessContext: string
): Promise<ManusAnalysisResult> {
  const baseUrl = process.env.MANUS_ENDPOINT ?? "https://api.manus.ai";
  const apiKey  = process.env.MANUS_API_KEY!;

  const prompt = `You are a customer complaint analyst for a small business.
Analyse the following customer message and determine the sentiment, severity, and any key topics.

Customer message: "${customerMessage}"

Respond ONLY with the structured output.`;

  const schema = {
    type: "object",
    properties: {
      sentiment: { type: "string", enum: ["positive", "neutral", "negative", "hostile"] },
      severity_score: { type: "number" },
      suggested_severity: { type: "string", enum: ["low", "medium", "high"] },
      key_topics: { type: "array", items: { type: "string" } },
      suggested_reply: { type: "string" },
      escalate: { type: "boolean" },
    },
    required: ["sentiment", "severity_score", "suggested_severity", "key_topics", "suggested_reply", "escalate"],
    additionalProperties: false,
  };

  const adapter = new ManusTaskAdapter(baseUrl, apiKey);
  // Reuse the task infrastructure but with a complaint-specific prompt
  const createRes = await fetch(`${baseUrl}/v2/task.create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manus-api-key": apiKey },
    body: JSON.stringify({
      message: { content: prompt },
      agent_profile: "manus-1.6-lite",
      hide_in_task_list: true,
      structured_output_schema: schema,
    }),
  });
  const createData = await createRes.json() as Record<string, any>;
  if (!createData["ok"]) throw new Error(`Manus complaint task failed: ${createData["error"]?.message}`);

  const taskId = createData["task_id"] as string;
  const deadline = Date.now() + 10_000;
  await sleep(3000);

  while (Date.now() < deadline) {
    await sleep(2000);
    const listRes = await fetch(
      `${baseUrl}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=20`,
      { headers: { "x-manus-api-key": apiKey } }
    );
    const listData = await listRes.json() as Record<string, any>;
    for (const msg of (listData["messages"] ?? []) as any[]) {
      if (msg.type === "structured_output_result" && msg.structured_output_result?.success) {
        return msg.structured_output_result.value as ManusAnalysisResult;
      }
    }
  }

  // Fallback to mock on timeout
  console.warn("[ManusService] callManusApi timed out — falling back to mock analysis");
  return mockAnalysis(customerMessage);
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
