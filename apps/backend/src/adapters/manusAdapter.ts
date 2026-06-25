import type { ExtractedOrder, Intent } from "@orderpilot/shared";

/**
 * ManusAdapter — External contract for the teammate Manus reasoning service.
 *
 * MANUS_MODE=mock     → MockManusAdapter (wraps local Router Agent, default)
 * MANUS_MODE=external → ExternalManusAdapter (calls MANUS_ENDPOINT)
 *
 * The Backend Safety Agent ALWAYS runs after Manus and has final authority.
 * No business action (order create, checkout) happens without Safety clearance.
 */

export interface ManusMessageContext {
  catalog: import("@orderpilot/shared").Product[];
  business_id: string;
  customer_name: string;
}

/**
 * Expected response shape from the teammate Manus endpoint.
 * POST MANUS_ENDPOINT/analyse
 */
export interface ManusDecision {
  intent: Intent;
  confidence: number;

  /**
   * Recommended backend action.
   * The backend may refine this based on its own Safety Agent check.
   */
  action:
    | "create_draft_order"
    | "ask_missing_order_details"
    | "answer_product_question"
    | "create_complaint"
    | "escalate_to_owner"
    | "ask_clarifying_question"
    | "human_handover";

  extracted_order: ExtractedOrder;
  missing_fields: string[];
  safety_flags: string[];
  requires_human: boolean;

  /** Draft reply text. The backend may use or override this. */
  reply_text: string;
  reason: string;
}

/** Adapter interface both Mock and External implementations must satisfy. */
export interface ManusAdapter {
  analyseMessage(message: string, context: ManusMessageContext): Promise<ManusDecision>;
}
