import { v4 as uuidv4 } from "uuid";
import type { AgentContext, AgentResult, DraftOrder, OrderItem, Product } from "@orderpilot/shared";
import { findProduct, formatCatalogForMessage } from "../services/catalogService";
import { getPaymentAdapter } from "../adapters/paymentAdapter";
import { saveDraftOrder } from "../db/repositories";

/**
 * Order Agent
 *
 * Extracts product, quantity, fulfillment type, date/time and notes
 * from a customer WhatsApp message, then:
 *
 * 1. Identifies which product(s) the customer wants
 * 2. Asks for missing information if needed
 * 3. Creates a draft order
 * 4. Calls PaymentAdapter.createCheckout()
 * 5. Returns a customer-facing reply with the checkout link
 */
export async function runOrderAgent(ctx: AgentContext): Promise<AgentResult> {
  const { message, customer_name, catalog, business_id, customer_phone, conversation_id } = ctx;
  const lower = message.toLowerCase();

  // ── 1. Extract product ────────────────────────────────────────────────────

  const matchedProduct = extractProduct(catalog, lower);

  if (!matchedProduct) {
    return {
      intent: "order",
      reply: buildProductNotFoundReply(customer_name, catalog),
    };
  }

  // ── 2. Extract quantity ───────────────────────────────────────────────────

  const quantity = extractQuantity(lower);

  // ── 3. Extract fulfillment ────────────────────────────────────────────────

  const fulfillment = extractFulfillment(lower);

  // ── 4. Extract date/time ──────────────────────────────────────────────────

  const requestedDate = extractDate(lower);

  // ── 5. Check if we have enough info to create the order ──────────────────

  const missingFields: string[] = [];
  if (!requestedDate) missingFields.push("pickup/delivery date");
  if (fulfillment === "delivery") missingFields.push("delivery address");

  if (missingFields.length > 0) {
    return {
      intent: "order",
      reply: buildMissingInfoReply(customer_name, matchedProduct, quantity, fulfillment, missingFields),
    };
  }

  // ── 6. Create draft order ─────────────────────────────────────────────────

  const item: OrderItem = {
    product_id: matchedProduct.id,
    product_name: matchedProduct.name,
    quantity,
    unit_price_gbp: matchedProduct.price_gbp,
    subtotal_gbp: matchedProduct.price_gbp * quantity,
  };

  const order: DraftOrder = {
    id: uuidv4(),
    business_id,
    customer_phone,
    customer_name,
    items: [item],
    fulfillment,
    requested_date: requestedDate,
    notes: extractNotes(lower),
    total_gbp: item.subtotal_gbp,
    status: "draft",
    checkout_url: null,
    created_at: new Date().toISOString(),
  };

  // ── 7. Create checkout ────────────────────────────────────────────────────

  const paymentAdapter = getPaymentAdapter();
  const checkout = await paymentAdapter.createCheckout(order);
  order.checkout_url = checkout.checkout_url;
  order.status = "pending_payment";

  await saveDraftOrder(order);

  // ── 8. Build reply ────────────────────────────────────────────────────────

  const reply = buildOrderConfirmationReply(customer_name, order, checkout.checkout_url);

  return {
    intent: "order",
    reply,
    order,
    checkout_url: checkout.checkout_url,
  };
}

// ─── Extraction helpers ────────────────────────────────────────────────────────

function extractProduct(catalog: Product[], lower: string): Product | undefined {
  // Try to match by product name
  for (const product of catalog) {
    const nameLower = product.name.toLowerCase();
    const keywords = nameLower.split(" ");
    if (keywords.every((kw) => lower.includes(kw))) return product;
  }
  // Fuzzy fallback — match any single significant word
  for (const product of catalog) {
    const significant = product.name.toLowerCase().split(" ").filter((w) => w.length > 4);
    if (significant.some((kw) => lower.includes(kw))) return product;
  }
  return undefined;
}

function extractQuantity(lower: string): number {
  const match = lower.match(/\b(\d+)\s*(cake|cakes|box|boxes|cupcake|cupcakes)\b/);
  if (match) return parseInt(match[1], 10);
  const wordNumbers: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  for (const [word, num] of Object.entries(wordNumbers)) {
    if (lower.includes(word)) return num;
  }
  return 1;
}

function extractFulfillment(lower: string): "pickup" | "delivery" {
  if (lower.includes("deliver") || lower.includes("send") || lower.includes("ship")) {
    return "delivery";
  }
  return "pickup";
}

function extractDate(lower: string): string | null {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const found = days.find((d) => lower.includes(d));
  if (found) return found.charAt(0).toUpperCase() + found.slice(1);

  if (lower.includes("tomorrow")) return "Tomorrow";
  if (lower.includes("today")) return "Today";
  if (lower.includes("weekend")) return "This Weekend";

  const dateMatch = lower.match(/(\d{1,2}(?:st|nd|rd|th)?)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/);
  if (dateMatch) return `${dateMatch[1]} ${dateMatch[2]}`;

  return null;
}

function extractNotes(lower: string): string {
  const notePatterns = [
    /(?:write|inscription|message|says?|say)[\s:]+["']?([^"',.]+)["']?/i,
    /(?:personalised?|custom)[\s:]+["']?([^"',.]+)["']?/i,
  ];
  for (const pattern of notePatterns) {
    const match = lower.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

// ─── Reply builders ───────────────────────────────────────────────────────────

function buildProductNotFoundReply(name: string, catalog: Product[]): string {
  const menu = formatCatalogForMessage(catalog);
  return `Hi ${name}! 🎂 I couldn't quite match that to one of our products. Here's what we have available:\n\n${menu}\n\nJust let me know what you'd like and I'll get that sorted for you!`;
}

function buildMissingInfoReply(
  name: string,
  product: Product,
  quantity: number,
  fulfillment: string,
  missingFields: string[]
): string {
  return (
    `Hi ${name}! Great choice — ${quantity}x ${product.name} (£${(product.price_gbp * quantity).toFixed(2)}) for ${fulfillment}.\n\n` +
    `I just need a couple more details:\n` +
    missingFields.map((f) => `• ${f}`).join("\n") +
    `\n\nCould you let me know?`
  );
}

function buildOrderConfirmationReply(
  name: string,
  order: DraftOrder,
  checkoutUrl: string
): string {
  const itemList = order.items
    .map((i) => `• ${i.quantity}x ${i.product_name} — £${i.subtotal_gbp.toFixed(2)}`)
    .join("\n");

  return (
    `Hi ${name}! Here's your order summary:\n\n` +
    `${itemList}\n` +
    `${order.fulfillment === "pickup" ? "🏪 Pickup" : "🚚 Delivery"}: ${order.requested_date}\n` +
    `💰 Total: £${order.total_gbp.toFixed(2)}\n\n` +
    `To confirm and pay, tap the link below:\n${checkoutUrl}\n\n` +
    `Your order will be confirmed once payment is received. 🎉`
  );
}
