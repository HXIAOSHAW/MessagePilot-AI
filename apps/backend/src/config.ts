/**
 * Backend runtime configuration.
 *
 * Reads environment variables once and exposes typed defaults. The complaint
 * agent uses Manus as its reasoning engine; the backend executes the resulting
 * actions (refunds, escalations) through its own adapters.
 */

import { AUTO_REFUND_MAX_GBP, HIGH_VALUE_ORDER_THRESHOLD_GBP } from "@orderpilot/shared";

export const config = {
  // ── Manus (agent brain) ─────────────────────────────────────────────────
  MANUS_API_KEY: process.env.MANUS_API_KEY ?? "",
  MANUS_BASE_URL: process.env.MANUS_BASE_URL ?? "https://api.manus.ai",
  // Agent profile: "manus-1.6" | "manus-1.6-lite" | "manus-1.6-max".
  // Lite is fastest, which matters for a synchronous WhatsApp reply.
  MANUS_AGENT_PROFILE: process.env.MANUS_AGENT_PROFILE ?? "manus-1.6-lite",
  // Manus tasks run asynchronously; we poll until the structured result lands.
  MANUS_POLL_TIMEOUT_MS: parseInt(process.env.MANUS_POLL_TIMEOUT_MS ?? "120000", 10),
  MANUS_POLL_INTERVAL_MS: parseInt(process.env.MANUS_POLL_INTERVAL_MS ?? "3000", 10),

  // ── Owner notifications ─────────────────────────────────────────────────
  OWNER_WHATSAPP: process.env.OWNER_WHATSAPP ?? "",

  // ── Business identity ───────────────────────────────────────────────────
  SHOP_NAME: process.env.SHOP_NAME ?? "OrderPilot",
  CURRENCY_SYMBOL: "£",

  // ── Business rules ──────────────────────────────────────────────────────
  AUTO_REFUND_MAX_GBP,
  HIGH_VALUE_ORDER_GBP: HIGH_VALUE_ORDER_THRESHOLD_GBP,
  REQUEST_TIMEOUT_MS: 30000,
} as const;

/** Whether a live Manus API key is configured. */
export function hasManusKey(): boolean {
  return config.MANUS_API_KEY.trim().length > 0;
}
