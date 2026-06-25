import { Router, Request, Response } from "express";
import { InboundMessageSchema } from "@orderpilot/shared";
import { DEFAULT_UNKNOWN_REPLY } from "@orderpilot/shared";
import { routeMessage } from "../agents/routerAgent";
import { runOrderAgent } from "../agents/orderAgent";
import { runComplaintAgent } from "../agents/complaintAgent";
import { getCatalog } from "../services/catalogService";
import { getMessagingAdapter } from "../adapters/messagingAdapter";
import { saveInboundMessage, saveAgentLog } from "../db/repositories";
import type { AgentContext } from "@orderpilot/shared";

const router = Router();

/**
 * POST /agent/message
 *
 * Accepts an inbound WhatsApp message and routes it to the appropriate agent.
 * Returns a customer-facing reply plus structured agent output.
 */
router.post("/message", async (req: Request, res: Response) => {
  const startTime = Date.now();

  // ── Validate input ────────────────────────────────────────────────────────
  const parsed = InboundMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const input = parsed.data;

  // ── Save inbound message ──────────────────────────────────────────────────
  await saveInboundMessage({
    ...input,
    received_at: new Date().toISOString(),
  });

  // ── Route intent ──────────────────────────────────────────────────────────
  const routing = routeMessage(input.message);
  console.log(`[Agent] ${input.conversation_id} → intent: ${routing.intent} (confidence: ${routing.confidence})`);

  // ── Load catalog ──────────────────────────────────────────────────────────
  const catalog = await getCatalog(input.business_id);

  const ctx: AgentContext = {
    ...input,
    catalog,
  };

  // ── Dispatch to agent ─────────────────────────────────────────────────────
  let result;

  try {
    if (routing.intent === "order") {
      result = await runOrderAgent(ctx);
    } else if (routing.intent === "complaint") {
      result = await runComplaintAgent(ctx);
    } else if (routing.intent === "human_handover") {
      result = {
        intent: routing.intent,
        reply: "I'm connecting you with a member of our team now. Someone will be with you shortly!",
      };
    } else {
      result = {
        intent: routing.intent,
        reply: DEFAULT_UNKNOWN_REPLY,
      };
    }
  } catch (err) {
    console.error("[Agent] Error running agent:", err);
    result = {
      intent: routing.intent,
      reply: "Sorry, something went wrong on our end. Please try again in a moment.",
    };
  }

  // ── Send reply via messaging adapter (non-blocking) ───────────────────────
  const messaging = getMessagingAdapter();
  messaging.sendMessage(input.customer_phone, result.reply).catch((err) => {
    console.error("[Agent] Failed to send WhatsApp reply:", err);
  });

  // ── Log agent action ──────────────────────────────────────────────────────
  const duration = Date.now() - startTime;
  await saveAgentLog({
    timestamp: new Date().toISOString(),
    business_id: input.business_id,
    conversation_id: input.conversation_id,
    customer_phone: input.customer_phone,
    intent: routing.intent,
    confidence: routing.confidence,
    agent: routing.intent === "order" ? "orderAgent" : routing.intent === "complaint" ? "complaintAgent" : "routerAgent",
    duration_ms: duration,
    success: true,
  });

  // ── Response ──────────────────────────────────────────────────────────────
  return res.json({
    success: true,
    intent: result.intent,
    reply: result.reply,
    order: result.order ?? null,
    complaint: result.complaint ?? null,
    owner_task: result.owner_task ?? null,
    checkout_url: result.checkout_url ?? null,
    routing: {
      intent: routing.intent,
      confidence: routing.confidence,
    },
    duration_ms: duration,
  });
});

export default router;
