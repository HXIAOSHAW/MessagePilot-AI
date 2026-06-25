# MessagePilot AI — Demo Script

_Estimated time: 4–5 minutes_

---

## Setup

```bash
pnpm install
cp .env.example .env   # leave all credentials blank — mock mode works
pnpm dev:backend       # → http://localhost:3001
```

Open a second terminal for the curl commands below.

---

## 0. Health check (15s)

```bash
curl http://localhost:3001/health
```

Point out:
- `"storage": "in-memory (mock)"` — no Supabase credentials needed
- `"manus": "mock"` — reasoning runs without Manus API key
- `"payment": "mock"` — checkout URL is simulated
- `"messaging": "mock"` — replies are logged to console, not sent to WhatsApp

---

## Demo 1 — Order (90s)

**Scenario:** Sarah messages the bakery on WhatsApp.

**Customer message:**
> "Hi, I want to order a chocolate birthday cake for Friday pickup."

**Expected flow:**  
Wassist message → MessagePilot backend → Manus reasoning → Safety check → draft order → mock PayPal checkout URL → Supabase / memory log

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000000",
    "customer_name": "Sarah",
    "message": "Hi, I want to order a chocolate birthday cake for Friday pickup.",
    "image_url": null,
    "conversation_id": "wa_conv_demo_order"
  }'
```

What to show:
- `intent: "order"` — Manus identified the purchase intent
- `conversation_state: "awaiting_payment"` — order is complete, checkout ready
- `checkout_url` — mock PayPal link sent to the customer
- `extracted_order.product_name` — product matched from catalog
- `extracted_order.requested_date: "Friday"` — date extracted from natural language
- `safety_flags: []` — clean message, no safety intervention needed
- `reply_text` — the friendly message sent back to the customer via Wassist

---

## Demo 2 — Complaint (90s)

**Scenario:** A customer had a bad experience and messages the bakery.

**Customer message:**
> "My cake arrived with the wrong name and the party is tonight. I am really upset."

**Expected flow:**  
Wassist message → MessagePilot backend → Manus reasoning → Safety check → complaint case → owner task → no refund or compensation promised

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111111111",
    "customer_name": "Emma",
    "message": "My cake arrived with the wrong name and the party is tonight. I am really upset.",
    "image_url": null,
    "conversation_id": "wa_conv_demo_complaint"
  }'
```

What to show:
- `intent: "complaint"` — Manus / Safety Agent identified complaint signals
- `safety_flags` — "wrong name", "really upset" detected as risky signals
- `complaint_id` — structured complaint case created
- `requires_human: false` — medium severity, agent handled safely
- `reply_text` — empathetic response, **no refund promised**, no legal language

Then show a high-severity case with a refund demand:

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111111112",
    "customer_name": "James",
    "message": "I am absolutely furious. My cake was completely wrong and I want a full refund immediately.",
    "image_url": null,
    "conversation_id": "wa_conv_demo_refund"
  }'
```

What to show:
- `requires_human: true` — refund demand triggers human escalation
- `safety_flags: ["refund", ...]` — safety rules fired
- `reply_text` — safe holding reply only, **the backend never auto-approves refunds**

---

## Demo 3 — Dashboard (30s)

After running both demos above, check the owner summary:

```bash
curl "http://localhost:3001/dashboard/summary?business_id=demo_luna_bakery"
```

What to show:
- `orders_drafted` — count of draft orders created
- `complaints_received` — count of complaint cases
- `owner_tasks_open` — tasks waiting for human review
- `top_products` — most ordered products
- `open_tasks` — list of tasks with priority

---

## Run all automated tests (30s)

```bash
bash scripts/demo_agent_core.sh
```

Runs all 7 canonical test cases with pass/fail assertions.

---

## What's next — integration hand-offs

| Integration | File | Env vars needed |
|---|---|---|
| Wassist (real WhatsApp) | `apps/backend/src/adapters/wassistAdapter.stub.ts` | `WASSIST_API_KEY` |
| PayPal Sandbox (real checkout) | `apps/backend/src/adapters/paypalAdapter.stub.ts` | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| Manus AI (real reasoning) | `apps/backend/src/services/manusService.ts` | `MANUS_API_KEY` |
| Supabase (persistent memory) | `supabase/schema.sql` then `.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
