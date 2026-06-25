import { v4 as uuidv4 } from "uuid";
import type {
  AgentContext,
  AgentResult,
  DraftOrder,
  OrderItem,
  Product,
  ExtractedOrder,
} from "@orderpilot/shared";
import { formatCatalogForMessage } from "../services/catalogService";
import { getPaymentAdapter } from "../adapters/paymentAdapter";
import { saveDraftOrder } from "../db/repositories";

// Required fields — ordered by priority of what to ask first.
// product → date → fulfillment → quantity
const REQUIRED_FIELDS: (keyof ExtractedOrder)[] = [
  "product_name",
  "requested_date",
  "fulfillment_method",
  "quantity",
];

/**
 * Order Agent
 *
 * 1. Extract all order slots from the message
 * 2. Identify which required slots are missing
 * 3. If anything is missing → ask ONE clear follow-up question (highest priority missing field)
 * 4. If all required fields present → create draft order → call PaymentAdapter → return checkout URL
 *
 * Always returns `extracted_order` and `missing_fields` so the route can
 * include them in the standardised response, regardless of whether the
 * order was completed.
 */
export async function runOrderAgent(ctx: AgentContext): Promise<AgentResult> {
  const { message, customer_name, catalog, business_id, customer_phone } = ctx;
  const lower = message.toLowerCase();

  // ── 1. Extract all slots ───────────────────────────────────────────────────

  const extracted = extractSlots(catalog, lower);

  // ── 2. Find missing required fields ───────────────────────────────────────

  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const val = extracted[field];
    return val === null || val === "unknown";
  });

  // ── 3. No product matched → show menu ─────────────────────────────────────

  if (!extracted.product_name) {
    return {
      intent: "order",
      reply: buildMenuReply(customer_name, catalog),
      extracted_order: extracted,
      missing_fields: missingFields,
      conversation_state: "awaiting_info",
    };
  }

  // ── 4. Missing required fields → ask one focused question ─────────────────

  if (missingFields.length > 0) {
    const reply = buildFollowUpQuestion(customer_name, extracted, missingFields[0]);
    return {
      intent: "order",
      reply,
      extracted_order: extracted,
      missing_fields: missingFields,
      conversation_state: "awaiting_info",
    };
  }

  // ── 5. All slots filled → build draft order ────────────────────────────────

  const unitPrice = catalog.find((p) => p.id === extracted.matched_catalog_product_id)!.price_gbp;
  const qty = extracted.quantity!;

  const item: OrderItem = {
    product_id: extracted.matched_catalog_product_id!,
    product_name: extracted.product_name!,
    quantity: qty,
    unit_price_gbp: unitPrice,
    subtotal_gbp: unitPrice * qty,
  };

  const order: DraftOrder = {
    id: uuidv4(),
    business_id,
    customer_phone,
    customer_name,
    items: [item],
    fulfillment: extracted.fulfillment_method as "pickup" | "delivery",
    requested_date: extracted.requested_date,
    notes: extracted.customer_notes ?? "",
    total_gbp: item.subtotal_gbp,
    status: "draft",
    checkout_url: null,
    created_at: new Date().toISOString(),
  };

  // ── 6. Create checkout ────────────────────────────────────────────────────

  const paymentAdapter = getPaymentAdapter();
  const checkout = await paymentAdapter.createCheckout(order);
  order.checkout_url = checkout.checkout_url;
  order.status = "pending_payment";

  await saveDraftOrder(order);

  const reply = buildConfirmationReply(customer_name, order, checkout.checkout_url);

  return {
    intent: "order",
    reply,
    order,
    checkout_url: checkout.checkout_url,
    extracted_order: extracted,
    missing_fields: [],
    conversation_state: "awaiting_payment",
  };
}

// ─── Slot extractor ────────────────────────────────────────────────────────────

function extractSlots(catalog: Product[], lower: string): ExtractedOrder {
  const matchedProduct = matchProduct(catalog, lower);

  return {
    product_name: matchedProduct?.name ?? null,
    matched_catalog_product_id: matchedProduct?.id ?? null,
    quantity: extractQuantity(lower),
    fulfillment_method: extractFulfillment(lower),
    requested_date: extractDate(lower),
    requested_time: extractTime(lower),
    customer_notes: extractNotes(lower),
  };
}

function matchProduct(catalog: Product[], lower: string): Product | undefined {
  // Pass 1: all significant words in product name must appear
  for (const p of catalog) {
    const words = p.name.toLowerCase().split(" ").filter((w) => w.length > 3);
    if (words.length > 0 && words.every((w) => lower.includes(w))) return p;
  }
  // Pass 2: any word longer than 5 chars from product name
  for (const p of catalog) {
    const significant = p.name.toLowerCase().split(" ").filter((w) => w.length > 5);
    if (significant.some((w) => lower.includes(w))) return p;
  }
  // Pass 3: short common names
  const shortNames: Record<string, string> = {
    "choc cake": "prod_choc_birthday_cake",
    "chocolate cake": "prod_choc_birthday_cake",
    "vanilla cake": "prod_vanilla_birthday_cake",
    "cupcakes": "prod_cupcake_box",
    "cupcake box": "prod_cupcake_box",
    "cupcake": "prod_cupcake_box",
  };
  for (const [alias, id] of Object.entries(shortNames)) {
    if (lower.includes(alias)) {
      return catalog.find((p) => p.id === id);
    }
  }
  return undefined;
}

function extractQuantity(lower: string): number | null {
  // Digit before a product word
  const digitMatch = lower.match(/\b(\d+)\s*(?:x\s*)?(?:cake|cakes|box|boxes|cupcake|cupcakes)\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  // Word numbers
  const wordMap: Record<string, number> = {
    one: 1, a: 1, an: 1,
    two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  for (const [word, num] of Object.entries(wordMap)) {
    // Match whole word only (avoid "a" matching inside other words)
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(lower)) return num;
  }

  // No quantity signal found — default to 1 only if a product was clearly named
  // (We return 1 rather than null because quantity is rarely stated explicitly)
  return 1;
}

function extractFulfillment(lower: string): "pickup" | "delivery" | "unknown" {
  if (/\b(deliver(ed|y)?|send|ship(ped)?|bring)\b/.test(lower)) return "delivery";
  if (/\b(pick\s*up|collect|collection|come\s*(and\s*)?collect|in\s*store)\b/.test(lower)) return "pickup";
  return "unknown";
}

function extractDate(lower: string): string | null {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const day = days.find((d) => lower.includes(d));
  if (day) return capitalise(day);
  if (lower.includes("tomorrow")) return "Tomorrow";
  if (lower.includes("today")) return "Today";
  if (lower.includes("this weekend") || lower.includes("the weekend")) return "This Weekend";
  if (lower.includes("next week")) return "Next Week";
  const dateMatch = lower.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/
  );
  if (dateMatch) return `${dateMatch[1]} ${capitalise(dateMatch[2])}`;
  return null;
}

function extractTime(lower: string): string | null {
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (timeMatch) {
    return `${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ""}${timeMatch[3]}`;
  }
  if (lower.includes("morning")) return "morning";
  if (lower.includes("afternoon")) return "afternoon";
  if (lower.includes("evening")) return "evening";
  return null;
}

function extractNotes(lower: string): string | null {
  const patterns = [
    /(?:write|inscription|message\s+(?:saying|reads?)?|says?)[\s:]+["']?([^"',.!?]{3,50})["']?/i,
    /(?:personalised?|custom(?:ised?)?)[\s:]+["']?([^"',.!?]{3,50})["']?/i,
    /(?:nut[- ]?free|gluten[- ]?free|dairy[- ]?free|vegan)/i,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) return match[1]?.trim() ?? match[0].trim();
  }
  return null;
}

// ─── Reply builders ────────────────────────────────────────────────────────────

function buildMenuReply(name: string, catalog: Product[]): string {
  const menu = formatCatalogForMessage(catalog);
  return (
    `Hi ${name}! I'd love to help you place an order. Here's what we have:\n\n` +
    `${menu}\n\n` +
    `Which one would you like?`
  );
}

function buildFollowUpQuestion(
  name: string,
  extracted: ExtractedOrder,
  missingField: string
): string {
  const productLine = extracted.product_name
    ? `${extracted.quantity ?? 1}x ${extracted.product_name}`
    : "your order";

  switch (missingField) {
    case "fulfillment_method":
      return `Hi ${name}! Great — ${productLine} sounds perfect. Would you like to pick it up in store, or would you prefer delivery?`;

    case "requested_date":
      return `Hi ${name}! Great choice — ${productLine}. What date would you like it for?`;

    case "quantity":
      return `Hi ${name}! How many ${extracted.product_name ?? "items"} would you like?`;

    case "product_name":
      return `Hi ${name}! Which product would you like to order?`;

    default:
      return `Hi ${name}! Could you let me know: ${missingField.replace(/_/g, " ")}?`;
  }
}

function buildConfirmationReply(name: string, order: DraftOrder, checkoutUrl: string): string {
  const lines = order.items
    .map((i) => `• ${i.quantity}x ${i.product_name} — £${i.subtotal_gbp.toFixed(2)}`)
    .join("\n");

  const fulfillmentIcon = order.fulfillment === "pickup" ? "🏪 Pickup" : "🚚 Delivery";

  return (
    `Hi ${name}! Here's your order:\n\n` +
    `${lines}\n` +
    `${fulfillmentIcon}: ${order.requested_date}\n` +
    `💰 Total: £${order.total_gbp.toFixed(2)}\n\n` +
    `Tap the link below to confirm and pay:\n${checkoutUrl}\n\n` +
    `We'll confirm your order as soon as payment is received. 🎉`
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
