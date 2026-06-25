// ─── Messaging Adapter Interface ─────────────────────────────────────────────
// Implement this interface with a real Wassist adapter when ready.

export interface MessagingAdapter {
  /**
   * Send a text message to a customer's WhatsApp number.
   */
  sendMessage(to: string, body: string): Promise<void>;

  /**
   * Send a message with a CTA button (e.g. "Pay Now" link).
   */
  sendButtonMessage(
    to: string,
    body: string,
    buttonLabel: string,
    url: string
  ): Promise<void>;
}

// ─── Factory: picks real or mock adapter based on env vars ───────────────────

import { MockMessagingAdapter } from "./mockMessagingAdapter";

// TODO: Import WassistAdapter from wassistAdapter.stub.ts once implemented
// import { WassistAdapter } from "./wassistAdapter.stub";

export function getMessagingAdapter(): MessagingAdapter {
  if (process.env.WASSIST_API_KEY) {
    // TODO: return new WassistAdapter() when the stub is implemented
    console.warn("[MessagingAdapter] WASSIST_API_KEY found but WassistAdapter not yet implemented — using mock");
  }
  return new MockMessagingAdapter();
}
