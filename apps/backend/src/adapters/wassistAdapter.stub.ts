/**
 * Wassist WhatsApp API Adapter — STUB
 *
 * TODO: Implement this file to connect to the Wassist API.
 *
 * Steps:
 * 1. Install the Wassist SDK or use fetch/axios
 * 2. Set WASSIST_API_KEY, WASSIST_PHONE_NUMBER_ID, WASSIST_WEBHOOK_SECRET in .env
 * 3. Implement the methods below following the MessagingAdapter interface
 * 4. In messagingAdapter.ts, uncomment the import and return new WassistAdapter()
 *
 * Wassist docs: https://docs.wassist.app  (TODO: confirm URL with team)
 */

import type { MessagingAdapter } from "./messagingAdapter";

export class WassistAdapter implements MessagingAdapter {
  private apiKey: string;
  private phoneNumberId: string;
  private baseUrl = "https://api.wassist.app/v1"; // TODO: confirm base URL

  constructor() {
    this.apiKey = process.env.WASSIST_API_KEY ?? "";
    this.phoneNumberId = process.env.WASSIST_PHONE_NUMBER_ID ?? "";

    if (!this.apiKey) {
      throw new Error("WASSIST_API_KEY is required");
    }
    if (!this.phoneNumberId) {
      throw new Error("WASSIST_PHONE_NUMBER_ID is required");
    }
  }

  async sendMessage(to: string, body: string): Promise<void> {
    // TODO: implement using Wassist send message endpoint
    // Example:
    // await fetch(`${this.baseUrl}/messages`, {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${this.apiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     messaging_product: "whatsapp",
    //     to,
    //     type: "text",
    //     text: { body },
    //   }),
    // });
    throw new Error("WassistAdapter.sendMessage not yet implemented");
  }

  async sendButtonMessage(
    to: string,
    body: string,
    buttonLabel: string,
    url: string
  ): Promise<void> {
    // TODO: implement using Wassist CTA URL button message type
    throw new Error("WassistAdapter.sendButtonMessage not yet implemented");
  }
}
