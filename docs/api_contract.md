# MessagePilot AI — API Contract

Base URL: `http://localhost:3001`

## Team integration points

Teammates only need three endpoints:

| Endpoint | Who calls it | Purpose |
|---|---|---|
| `POST /agent/message` | **Wassist** | Sends every inbound customer WhatsApp message into the backend |
| `POST /payment/status` | **PayPal** | Fires when a customer completes or fails a payment — order confirmed here |
| `GET /dashboard/summary` | **Frontend / demo** | Owner summary — orders, complaints, open tasks |

---

## Environment configuration

| Variable | Values | Effect |
|---|---|---|
| `DATA_MODE` | `supabase` / (blank) | Blank = in-memory mock. `supabase` = Supabase for products + orders. |
| `SUPABASE_STRICT` | `true` / `false` | `true` = fail hard when Supabase products empty (no silent fallback). |
| `MANUS_MODE` | `mock` / `external` | `mock` = local Router Agent. `external` = call teammate Manus service. |
| `MANUS_ENDPOINT` | URL | Required when `MANUS_MODE=external`. |
| `MANUS_API_KEY` | string | Optional auth for external Manus. |

**Teammate Manus contract:** `apps/backend/src/adapters/manusAdapter.ts`  
**Teammate Wassist integration:** `apps/backend/src/adapters/wassistAdapter.stub.ts`  
**Teammate PayPal integration:** `apps/backend/src/adapters/paypalAdapter.stub.ts`

---

## GET /health

Returns the server status and adapter configuration.

### Response

```json
{
  "status": "ok",
  "service": "MessagePilot AI Backend",
  "version": "0.1.0",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "storage": "in-memory (mock)",
  "adapters": {
    "messaging": "mock",
    "payment": "mock",
    "manus": "mock"
  }
}
```

---

## POST /agent/message

Accepts an inbound WhatsApp message, routes it through the agent pipeline,
and always returns the full standardised response shape below.

Pipeline: `Router Agent → Safety Check → Order Agent / Complaint Agent → Response`

### Request body

```json
{
  "business_id": "demo_luna_bakery",
  "customer_phone": "+447000000000",
  "customer_name": "Sarah",
  "message": "I want to order a chocolate birthday cake for Friday pickup",
  "image_url": null,
  "conversation_id": "wa_conv_123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `business_id` | string | ✓ | Business identifier — must have a catalog file |
| `customer_phone` | string | ✓ | Customer's WhatsApp number |
| `customer_name` | string | ✓ | Customer's display name |
| `message` | string | ✓ | The message text |
| `image_url` | string \| null | ✓ | Attached image URL (null if none) |
| `conversation_id` | string | ✓ | WhatsApp conversation thread ID |

### Response — always this shape

Every field is always present. Missing values are `null`, `[]`, or `false`.

```json
{
  "reply_text": "Hi Sarah! Here's your order:\n\n• 1x Chocolate Birthday Cake — £29.00\n🏪 Pickup: Friday\n💰 Total: £29.00\n\nTap the link below to confirm and pay:\nhttps://demo.orderpilot.ai/pay/...\n\nWe'll confirm your order as soon as payment is received. 🎉",

  "intent": "order",
  "confidence": 0.86,
  "router_reason": "Strong order signal(s): for friday, i want to order",

  "conversation_state": "awaiting_payment",
  "requires_human": false,

  "order_id": "uuid-or-null",
  "complaint_id": null,
  "checkout_url": "https://demo.orderpilot.ai/pay/...",

  "missing_fields": [],

  "extracted_order": {
    "product_name": "Chocolate Birthday Cake",
    "matched_catalog_product_id": "prod_choc_birthday_cake",
    "quantity": 1,
    "fulfillment_method": "pickup",
    "requested_date": "Friday",
    "requested_time": null,
    "customer_notes": null
  },

  "safety_flags": [],

  "data_mode": "memory",
  "product_lookup_source": "memory",
  "fallback_used": false,
  "supabase_order_created": false,

  "manus_used": false,
  "manus_fallback": false
}
```

### Response fields

| Field | Type | Description |
|---|---|---|
| `reply_text` | string | Customer-facing reply — send this to WhatsApp |
| `intent` | `order \| complaint \| product_question \| human_handover \| unknown` | Classified intent |
| `confidence` | number (0–1) | Router confidence score |
| `router_reason` | string | Human-readable explanation of routing decision |
| `conversation_state` | string | See states table below |
| `requires_human` | boolean | True when a human must follow up |
| `order_id` | string \| null | UUID of created draft order (order intent only) |
| `complaint_id` | string \| null | UUID of created complaint case (complaint intent only) |
| `checkout_url` | string \| null | Mock checkout URL (set when order is complete) |
| `missing_fields` | string[] | Required order fields not yet provided |
| `extracted_order` | object | All extracted order slots (nulls for missing) |
| `safety_flags` | string[] | Risky signals detected in the message |
| `data_mode` | `memory \| supabase` | Active data mode for this request |
| `product_lookup_source` | `memory \| supabase \| fallback` | Where products were loaded from |
| `fallback_used` | boolean | `true` when Supabase was attempted but local JSON was used |
| `supabase_order_created` | boolean | `true` when the draft order was written to Supabase |
| `manus_used` | boolean | `true` when external Manus was called for this request |
| `manus_fallback` | boolean | `true` when Manus failed and local Router Agent was used instead |

### `conversation_state` values

| State | Meaning |
|---|---|
| `awaiting_payment` | Order complete — checkout URL returned |
| `awaiting_info` | Order intent but required fields missing — follow-up question sent |
| `complaint` | Message routed to Complaint Agent |
| `human_handover` | Human must take over |
| `product_question` | Price / availability question answered |
| `awaiting_clarification` | Ambiguous message — clarification question sent |
| `error` | Agent error (retry safe) |

### `missing_fields` values

Only populated when `intent = order` and `conversation_state = awaiting_info`.

| Value | Meaning |
|---|---|
| `product_name` | No product matched in catalog |
| `requested_date` | No date/day provided |
| `fulfillment_method` | Pickup or delivery not specified |
| `quantity` | Number of items unclear |

### `extracted_order` schema

Always returned (all nulls if intent is not order).

```json
{
  "product_name": "string | null",
  "matched_catalog_product_id": "string | null",
  "quantity": "number | null",
  "fulfillment_method": "pickup | delivery | unknown",
  "requested_date": "string | null",
  "requested_time": "string | null",
  "customer_notes": "string | null"
}
```

### What teammates can rely on

- `reply_text` is always a safe, customer-facing string — send it directly to WhatsApp
- `checkout_url` is non-null **only** when all required order fields were extracted and a checkout was created
- `missing_fields` is `[]` when an order is complete or when intent is not order
- `safety_flags` is `[]` for clean messages; non-empty means a risky signal was detected
- `requires_human` is always `true` for `human_handover` intent and for high-severity complaints
- The response shape never changes — all fields are always present

### What remains mocked

| Field | Mock behaviour | Real integration |
|---|---|---|
| `checkout_url` | `https://demo.orderpilot.ai/pay/...` format | PayPal sandbox → `paypalAdapter.stub.ts` |
| WhatsApp delivery | Logs to console | Wassist → `wassistAdapter.stub.ts` |
| `complaint_id` escalation | In-memory store | Supabase → set `SUPABASE_URL` in `.env` |

### Canonical test cases

Run all 7 with:
```bash
bash scripts/demo_agent_core.sh
```

| # | Message | Expected intent | Expected state |
|---|---|---|---|
| 1 | "I want to order a chocolate birthday cake for Friday pickup" | `order` | `awaiting_payment` |
| 2 | "I want a chocolate cake" | `order` | `awaiting_info` |
| 3 | "Can I get two cupcake boxes delivered tomorrow?" | `order` | `awaiting_payment` |
| 4 | "How much is the vanilla cake?" | `product_question` | `product_question` |
| 5 | "My chocolate cake arrived damaged and I want a refund" | `complaint` | `complaint` |
| 6 | "My cake has the wrong name and I am really upset" | `complaint` | `complaint` |
| 7 | "Can you help me with a cake?" | `unknown` | `awaiting_clarification` |

### Error response

```json
{ "error": "Invalid request", "details": { "fieldErrors": { "business_id": ["Required"] } } }
```

---

## POST /payment/status

Webhook endpoint for payment provider callbacks.

### Request body

```json
{
  "order_id": "uuid",
  "payment_provider_ref": "PAYPAL-ABC123",
  "status": "completed",
  "amount_gbp": 29.00,
  "business_id": "demo_luna_bakery"
}
```

| `status` values | Meaning |
|---|---|
| `completed` | Payment successful → order moves to `confirmed` |
| `failed` | Payment failed → order stays in current status |
| `pending` | Payment pending → no status change |
| `refunded` | Refund issued → order moves to `cancelled` |

### Response

```json
{
  "success": true,
  "order_id": "uuid",
  "new_status": "confirmed",
  "processed_at": "2026-06-25T12:00:00.000Z"
}
```

---

## GET /dashboard/summary

Returns an operations summary for the owner dashboard.

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `business_id` | ✓ | The business to summarise |

### Response

```json
{
  "business_id": "demo_luna_bakery",
  "period": "all_time",
  "total_messages": 5,
  "orders_drafted": 3,
  "complaints_received": 2,
  "owner_tasks_open": 1,
  "top_products": [
    { "name": "Chocolate Birthday Cake", "count": 2 },
    { "name": "Cupcake Box", "count": 1 }
  ],
  "open_tasks": [
    {
      "id": "uuid",
      "type": "complaint_escalation",
      "title": "[HIGH] Complaint from James",
      "priority": "urgent",
      "status": "open",
      "created_at": "2026-06-25T12:00:00.000Z"
    }
  ],
  "generated_at": "2026-06-25T12:00:00.000Z"
}
```
