import { v4 as uuidv4 } from "uuid";
import type { DraftOrder } from "@orderpilot/shared";
import type { CheckoutResult } from "../types";
import type { PaymentAdapter } from "./paymentAdapter";

/**
 * Mock payment adapter — returns fake checkout URLs.
 * Used when no PayPal credentials are configured.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  async createCheckout(order: DraftOrder): Promise<CheckoutResult> {
    const ref = `MOCK-${uuidv4().substring(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    console.log(`[MockPayment] Created checkout for order ${order.id}, total £${order.total_gbp}`);

    return {
      checkout_url: `https://demo.orderpilot.ai/pay/${order.id}?ref=${ref}`,
      provider_ref: ref,
      expires_at: expiresAt,
    };
  }

  async capturePayment(orderId: string, providerRef: string): Promise<void> {
    console.log(`[MockPayment] Captured payment for order ${orderId}, ref ${providerRef}`);
  }

  async getPaymentStatus(
    orderId: string
  ): Promise<"pending" | "completed" | "failed" | "refunded"> {
    console.log(`[MockPayment] Status check for order ${orderId}`);
    return "pending";
  }
}
