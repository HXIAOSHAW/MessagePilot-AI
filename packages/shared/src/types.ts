// ─── Core domain types shared across backend and web ─────────────────────────

export type Intent =
  | "order"
  | "complaint"
  | "product_question"
  | "human_handover"
  | "unknown";

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "confirmed"
  | "fulfilled"
  | "cancelled";

export type ComplaintSeverity = "low" | "medium" | "high";

export type TaskStatus = "open" | "in_progress" | "resolved";

// ─── Inbound message ─────────────────────────────────────────────────────────

export interface InboundMessage {
  business_id: string;
  customer_phone: string;
  customer_name: string;
  message: string;
  image_url: string | null;
  conversation_id: string;
}

// ─── Agent context ────────────────────────────────────────────────────────────

export interface AgentContext {
  business_id: string;
  customer_phone: string;
  customer_name: string;
  message: string;
  image_url: string | null;
  conversation_id: string;
  catalog: Product[];
}

// ─── Extracted order slots ────────────────────────────────────────────────────

export interface ExtractedOrder {
  product_name: string | null;
  matched_catalog_product_id: string | null;
  quantity: number | null;
  fulfillment_method: "pickup" | "delivery" | "unknown";
  requested_date: string | null;
  requested_time: string | null;
  customer_notes: string | null;
}

export const EMPTY_EXTRACTED_ORDER: ExtractedOrder = {
  product_name: null,
  matched_catalog_product_id: null,
  quantity: null,
  fulfillment_method: "unknown",
  requested_date: null,
  requested_time: null,
  customer_notes: null,
};

// ─── Agent result ─────────────────────────────────────────────────────────────

export interface AgentResult {
  intent: Intent;
  reply: string;
  order?: DraftOrder;
  complaint?: ComplaintCase;
  owner_task?: OwnerTask;
  checkout_url?: string;
  extracted_order?: ExtractedOrder;
  missing_fields?: string[];
  conversation_state?: string;
  metadata?: Record<string, unknown>;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  price_gbp: number;
  description: string;
  available: boolean;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export interface DraftOrder {
  id: string;
  business_id: string;
  customer_phone: string;
  customer_name: string;
  items: OrderItem[];
  fulfillment: "pickup" | "delivery";
  requested_date: string | null;
  notes: string;
  total_gbp: number;
  status: OrderStatus;
  checkout_url: string | null;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_gbp: number;
  subtotal_gbp: number;
}

// ─── Complaint ────────────────────────────────────────────────────────────────

export interface ComplaintCase {
  id: string;
  business_id: string;
  customer_phone: string;
  customer_name: string;
  issue_summary: string;
  order_reference: string | null;
  urgency: "low" | "medium" | "high";
  evidence: string[];
  desired_outcome: string;
  severity: ComplaintSeverity;
  safe_reply: string;
  requires_escalation: boolean;
  created_at: string;
}

// ─── Owner task ───────────────────────────────────────────────────────────────

export interface OwnerTask {
  id: string;
  business_id: string;
  type: "order_review" | "complaint_escalation" | "human_handover";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  related_order_id: string | null;
  related_complaint_id: string | null;
  status: TaskStatus;
  created_at: string;
}

// ─── Business ────────────────────────────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  owner_phone: string;
  currency: string;
  timezone: string;
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

export interface DashboardSummary {
  business_id: string;
  period: string;
  total_messages: number;
  orders_drafted: number;
  complaints_received: number;
  owner_tasks_open: number;
  top_products: { name: string; count: number }[];
}
