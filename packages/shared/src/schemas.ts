import { z } from "zod";

// ─── Inbound message schema ────────────────────────────────────────────────────

export const InboundMessageSchema = z.object({
  business_id: z.string().min(1, "business_id is required"),
  customer_phone: z.string().min(1, "customer_phone is required"),
  customer_name: z.string().min(1, "customer_name is required"),
  message: z.string().min(1, "message is required"),
  image_url: z.string().url().nullable().default(null),
  conversation_id: z.string().min(1, "conversation_id is required"),
});

export type InboundMessageInput = z.infer<typeof InboundMessageSchema>;

// ─── Payment status schema ────────────────────────────────────────────────────

export const PaymentStatusSchema = z.object({
  order_id: z.string().min(1),
  payment_provider_ref: z.string().min(1),
  status: z.enum(["completed", "failed", "pending", "refunded"]),
  amount_gbp: z.number().positive(),
  business_id: z.string().min(1),
});

export type PaymentStatusInput = z.infer<typeof PaymentStatusSchema>;

// ─── Dashboard query schema ───────────────────────────────────────────────────

export const DashboardQuerySchema = z.object({
  business_id: z.string().min(1),
});
