/**
 * PayPal Sandbox Adapter — STUB
 *
 * TODO: Implement this file to connect to the PayPal Orders v2 API.
 *
 * Steps:
 * 1. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_SANDBOX=true in .env
 * 2. Implement the methods below following the PaymentAdapter interface
 * 3. In paymentAdapter.ts, uncomment the import and return new PayPalAdapter()
 *
 * PayPal docs: https://developer.paypal.com/docs/api/orders/v2/
 */

import type { DraftOrder } from "@orderpilot/shared";
import type { CheckoutResult, RefundResult } from "../types";
import type { PaymentAdapter } from "./paymentAdapter";

const PAYPAL_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_BASE = "https://api-m.paypal.com";

export class PayPalAdapter implements PaymentAdapter {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID ?? "";
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "";
    this.baseUrl =
      process.env.PAYPAL_SANDBOX === "false" ? PAYPAL_LIVE_BASE : PAYPAL_SANDBOX_BASE;

    if (!this.clientId || !this.clientSecret) {
      throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
    }
  }

  private async getAccessToken(): Promise<string> {
    // TODO: implement OAuth2 client_credentials flow
    // POST ${this.baseUrl}/v1/oauth2/token
    throw new Error("PayPalAdapter.getAccessToken not yet implemented");
  }

  async createCheckout(order: DraftOrder): Promise<CheckoutResult> {
    // TODO: implement POST ${this.baseUrl}/v2/checkout/orders
    // Use order.total_gbp, line items, and return the approve link
    throw new Error("PayPalAdapter.createCheckout not yet implemented");
  }

  async capturePayment(orderId: string, providerRef: string): Promise<void> {
    // TODO: implement POST ${this.baseUrl}/v2/checkout/orders/${providerRef}/capture
    throw new Error("PayPalAdapter.capturePayment not yet implemented");
  }

  async getPaymentStatus(
    orderId: string
  ): Promise<"pending" | "completed" | "failed" | "refunded"> {
    // TODO: implement GET ${this.baseUrl}/v2/checkout/orders/${orderId}
    throw new Error("PayPalAdapter.getPaymentStatus not yet implemented");
  }

  async refund(orderId: string, amountGbp: number, reason: string): Promise<RefundResult> {
    // TODO: implement POST ${this.baseUrl}/v2/payments/captures/${captureId}/refund
    throw new Error("PayPalAdapter.refund not yet implemented");
  }
}
