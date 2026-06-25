import { v4 as uuidv4 } from "uuid";
import type { DraftOrder } from "@orderpilot/shared";
import type { CheckoutResult } from "../types";
import type { PaymentAdapter } from "./paymentAdapter";

/**
 * Mock Payment Adapter — used for demo when no PayPal credentials are set.
 *
 * In the real flow:
 *   1. createCheckout() → returns a PayPal checkout URL sent to the customer
 *   2. Customer pays on PayPal
 *   3. PayPal calls POST /payment/status with status="completed"
 *   4. Backend marks order as "confirmed" — never before that webhook fires
 *
 * To connect PayPal Sandbox, implement paypalAdapter.stub.ts and set
 * PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET in .env.
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
