import type { ManusAdapter, ManusDecision, ManusMessageContext } from "./manusAdapter";
import { routeMessage } from "../agents/routerAgent";
import { EMPTY_EXTRACTED_ORDER } from "@orderpilot/shared";
import type { ExtractedOrder, Intent } from "@orderpilot/shared";

/**
 * MockManusAdapter — used when MANUS_MODE=mock (default).
 *
 * Delegates intent classification to the local Router Agent (keyword-based).
 * This lets the backend run end-to-end without a real Manus service, while
 * still exposing the same ManusAdapter interface the External adapter uses.
 *
 * The teammate can build a real Manus service that returns ManusDecision and
 * the backend will work without any further changes — just set:
 *   MANUS_MODE=external
 *   MANUS_ENDPOINT=https://<teammate-manus-url>
 */
export class MockManusAdapter implements ManusAdapter {
  async analyseMessage(
    message: string,
    _context: ManusMessageContext
  ): Promise<ManusDecision> {
    const routing = routeMessage(message);

    const action = intentToAction(routing.intent);

    return {
      intent: routing.intent,
      confidence: routing.confidence,
      action,
      extracted_order: { ...EMPTY_EXTRACTED_ORDER } as ExtractedOrder,
      missing_fields: [],
      safety_flags: [],
      requires_human: routing.intent === "human_handover",
      reply_text: "",
      reason: `mock-router: ${routing.reason}`,
    };
  }
}

function intentToAction(intent: Intent): ManusDecision["action"] {
  switch (intent) {
    case "order":
      return "create_draft_order";
    case "complaint":
      return "create_complaint";
    case "product_question":
      return "answer_product_question";
    case "human_handover":
      return "human_handover";
    default:
      return "ask_clarifying_question";
  }
}
