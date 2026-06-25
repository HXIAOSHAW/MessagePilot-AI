import { MessagingAdapter } from "./messagingAdapter";

/**
 * Mock messaging adapter — logs outbound messages to the console.
 * Used when no Wassist credentials are configured.
 */
export class MockMessagingAdapter implements MessagingAdapter {
  async sendMessage(to: string, body: string): Promise<void> {
    console.log(`[MockMessaging] → ${to}: ${body}`);
  }

  async sendButtonMessage(
    to: string,
    body: string,
    buttonLabel: string,
    url: string
  ): Promise<void> {
    console.log(`[MockMessaging] → ${to}: ${body} | Button: [${buttonLabel}] → ${url}`);
  }
}
