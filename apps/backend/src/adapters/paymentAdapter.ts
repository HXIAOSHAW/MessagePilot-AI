// ─── Payment Adapter Interface ────────────────────────────────────────────────
// Implement this interface with a real PayPal sandbox adapter when ready.

import type { DraftOrder } from "@orderpilot/shared";
import type { CheckoutResult } from "../types";

export interface PaymentAdapter {
  /**
   * Create a checkout session for a draft order.
   * Returns a URL the customer can visit to pay.
   */
  createCheckout(order: DraftOrder): Promise<CheckoutResult>;

  /**
   * Mark an order as paid given a provider payment reference.
   */
  capturePayment(orderId: string, providerRef: string): Promise<void>;

  /**
   * Fetch the current payment status from the provider.
   */
  getPaymentStatus(orderId: string): Promise<"pending" | "completed" | "failed" | "refunded">;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

import { MockPaymentAdapter } from "./mockPaymentAdapter";

// TODO: Import PayPalAdapter from paypalAdapter.stub.ts once implemented
// import { PayPalAdapter } from "./paypalAdapter.stub";

export function getPaymentAdapter(): PaymentAdapter {
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    // TODO: return new PayPalAdapter() when the stub is implemented
    console.warn("[PaymentAdapter] PayPal credentials found but PayPalAdapter not yet implemented — using mock");
  }
  return new MockPaymentAdapter();
}
