import { Router, Request, Response } from "express";
import { InboundMessageSchema, EMPTY_EXTRACTED_ORDER } from "@orderpilot/shared";
import { DEFAULT_UNKNOWN_REPLY, DEFAULT_OWNER_ESCALATION_MESSAGE } from "@orderpilot/shared";
import { routeMessage } from "../agents/routerAgent";
import { runOrderAgent } from "../agents/orderAgent";
import { runComplaintAgent } from "../agents/complaintAgent";
import { checkOrderSafety } from "../agents/safetyAgent";
import { getCatalog } from "../services/catalogService";
import { getMessagingAdapter } from "../adapters/messagingAdapter";
import { saveInboundMessage, saveAgentLog } from "../db/repositories";
import type { AgentContext, ExtractedOrder } from "@orderpilot/shared";

const router = Router();

/**
 * POST /agent/message
 *
 * Pipeline:
 *   1. Validate input (Zod)
 *   2. Save inbound message
 *   3. Router Agent → intent, confidence, reason
 *   4. Safety check (order path only)
 *   5. Dispatch to Order Agent or Complaint Agent
 *   6. Assemble standard response
 *   7. Send reply via Messaging Adapter (non-blocking)
 *   8. Log
 *
 * Always returns the full response shape defined in docs/api_contract.md —
 * every field is present, missing values are null / [] / false.
 */
router.post("/message", async (req: Request, res: Response) => {
  const startTime = Date.now();

  // ── 1. Validate input ─────────────────────────────────────────────────────
  const parsed = InboundMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const input = parsed.data;

  // ── 2. Save inbound message ───────────────────────────────────────────────
  await saveInboundMessage({ ...input, received_at: new Date().toISOString() });

  // ── 3. Route intent ───────────────────────────────────────────────────────
  const routing = routeMessage(input.message);
  console.log(
    `[Agent] ${input.conversation_id} → ${routing.intent} (${routing.confidence}) — ${routing.reason}`
  );

  // ── 4. Load catalog ───────────────────────────────────────────────────────
  const catalog = await getCatalog(input.business_id);

  const ctx: AgentContext = { ...input, catalog };

  // ── 5. Safety pre-check for order path ───────────────────────────────────
  //    Run this before dispatching so a risky message cannot slip through
  //    even if the router classified it as an order.
  const orderSafety = checkOrderSafety(input.message);

  if (!orderSafety.safe && routing.intent === "order") {
    // Safety overrides the router — treat as complaint/human_handover
    const overrideIntent = orderSafety.requires_human ? "human_handover" : "complaint";
    console.warn(
      `[Agent] Safety override: ${routing.intent} → ${overrideIntent} (flags: ${orderSafety.safety_flags.join(", ")})`
    );
    routing.intent = overrideIntent;
    routing.reason = `Safety override — ${orderSafety.reason}`;
  }

  // ── 6. Dispatch ───────────────────────────────────────────────────────────
  let replyText = "";
  let conversationState = "new";
  let orderId: string | null = null;
  let complaintId: string | null = null;
  let checkoutUrl: string | null = null;
  let missingFields: string[] = [];
  let extractedOrder: ExtractedOrder = { ...EMPTY_EXTRACTED_ORDER };
  let requiresHuman = orderSafety.requires_human;

  try {
    if (routing.intent === "order") {
      const result = await runOrderAgent(ctx);
      replyText = result.reply;
      conversationState = result.conversation_state ?? "awaiting_info";
      orderId = result.order?.id ?? null;
      checkoutUrl = result.checkout_url ?? null;
      missingFields = result.missing_fields ?? [];
      extractedOrder = result.extracted_order ?? { ...EMPTY_EXTRACTED_ORDER };

    } else if (routing.intent === "complaint") {
      const result = await runComplaintAgent(ctx);
      replyText = result.reply;
      conversationState = "complaint";
      complaintId = result.complaint?.id ?? null;
      requiresHuman = result.complaint?.requires_escalation ?? false;

    } else if (routing.intent === "human_handover") {
      replyText =
        "I'm connecting you with a member of our team now. Someone will be with you shortly — thank you for your patience!";
      conversationState = "human_handover";
      requiresHuman = true;

    } else if (routing.intent === "product_question") {
      replyText = buildProductQuestionReply(input.customer_name, catalog);
      conversationState = "product_question";

    } else {
      // unknown — ambiguous message
      replyText = buildClarificationReply(input.customer_name);
      conversationState = "awaiting_clarification";
    }
  } catch (err) {
    console.error("[Agent] Error running agent:", err);
    replyText = "Sorry, something went wrong. Please try again in a moment.";
    conversationState = "error";
  }

  // ── 7. Send via Messaging Adapter (non-blocking) ──────────────────────────
  getMessagingAdapter()
    .sendMessage(input.customer_phone, replyText)
    .catch((err) => console.error("[Agent] Messaging error:", err));

  // ── 8. Log ────────────────────────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  await saveAgentLog({
    timestamp: new Date().toISOString(),
    business_id: input.business_id,
    conversation_id: input.conversation_id,
    customer_phone: input.customer_phone,
    intent: routing.intent,
    confidence: routing.confidence,
    router_reason: routing.reason,
    safety_flags: orderSafety.safety_flags,
    agent:
      routing.intent === "order"
        ? "orderAgent"
        : routing.intent === "complaint"
        ? "complaintAgent"
        : "routerAgent",
    duration_ms: durationMs,
    success: true,
  });

  // ── 9. Standard response ──────────────────────────────────────────────────
  return res.json({
    reply_text: replyText,
    intent: routing.intent,
    confidence: routing.confidence,
    router_reason: routing.reason,
    conversation_state: conversationState,
    requires_human: requiresHuman,
    order_id: orderId,
    complaint_id: complaintId,
    checkout_url: checkoutUrl,
    missing_fields: missingFields,
    extracted_order: extractedOrder,
    safety_flags: orderSafety.safety_flags,
  });
});

// ─── Reply helpers for non-agent intents ──────────────────────────────────────

function buildProductQuestionReply(name: string, catalog: import("@orderpilot/shared").Product[]): string {
  const lines = catalog
    .filter((p) => p.available)
    .map((p) => `• ${p.name} — £${p.price_gbp.toFixed(2)}\n  ${p.description}`)
    .join("\n");
  return `Hi ${name}! Here's what we offer:\n\n${lines}\n\nWould you like to place an order?`;
}

function buildClarificationReply(name: string): string {
  return (
    `Hi ${name}! I'm here to help — are you looking to:\n\n` +
    `• Place an order for a cake or cupcakes?\n` +
    `• Ask about our products or prices?\n` +
    `• Something else?\n\n` +
    `Just let me know and I'll get it sorted for you!`
  );
}

export default router;
