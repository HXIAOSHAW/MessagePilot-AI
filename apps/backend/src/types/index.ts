// Backend-specific types that extend the shared package types

export interface LogEntry {
  timestamp: string;
  business_id: string;
  conversation_id: string;
  customer_phone: string;
  intent: string;
  agent: string;
  duration_ms: number;
  success: boolean;
  error?: string;
}

export interface CheckoutResult {
  checkout_url: string;
  provider_ref: string;
  expires_at: string;
}

export interface RefundResult {
  refund_id: string;
  status: string;
  amount_gbp: number;
}

/**
 * Structured decision returned by the Manus complaint task.
 * Matches the `structured_output_schema` sent to Manus.
 */
export interface ManusComplaintDecision {
  severity: "low" | "medium" | "high";
  risk_flags: string[];
  action: "auto_resolve" | "issue_refund" | "escalate";
  refund_amount_gbp: number;
  order_reference: string | null;
  reply_text: string;
  owner_summary: string;
  reasoning: string;
}
