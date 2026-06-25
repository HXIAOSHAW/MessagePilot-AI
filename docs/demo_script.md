# OrderPilot AI — Demo Script

_Estimated time: 5–7 minutes_

---

## Setup (before demo)

```bash
pnpm install
cp .env.example .env
pnpm dev:backend
```

Open a second terminal for curl commands.

---

## 1. Show the health endpoint (30s)

**Say:** "The backend is running. Let's check it — you can see it's using the mock payment and messaging adapters by default, so no external accounts needed."

```bash
curl http://localhost:3001/health | jq
```

**Point out:** `storage: "in-memory (mock)"`, adapter list.

---

## 2. Order flow — happy path (90s)

**Say:** "Sarah messages the bakery on WhatsApp. She wants a chocolate birthday cake for Friday. Watch what happens."

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000000",
    "customer_name": "Sarah",
    "message": "I want to order a chocolate birthday cake for Friday pickup",
    "image_url": null,
    "conversation_id": "wa_conv_123"
  }' | jq '{intent, reply, checkout_url, total: .order.total_gbp}'
```

**Point out:**
- `intent: "order"` — Router Agent classified correctly
- `reply` — natural, friendly message with order summary
- `checkout_url` — customer taps this to pay (PayPal in production)
- `total` — £29 calculated automatically from catalog

---

## 3. Order flow — missing info (60s)

**Say:** "What if the customer forgets to say when they want it? The agent asks for the missing info instead of guessing."

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000000",
    "customer_name": "Tom",
    "message": "I want to order a chocolate cake",
    "image_url": null,
    "conversation_id": "wa_conv_124"
  }' | jq '{intent, reply}'
```

---

## 4. Complaint flow — low severity (60s)

**Say:** "Now let's look at complaints. Rachel received the wrong cake. Low severity — agent handles it gracefully without escalation."

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111000001",
    "customer_name": "Rachel",
    "message": "I ordered a chocolate cake but got a vanilla one. Bit disappointed.",
    "image_url": null,
    "conversation_id": "wa_conv_125"
  }' | jq '{intent, severity: .complaint.severity, escalated: .complaint.requires_escalation, reply}'
```

---

## 5. Complaint flow — high severity + safety rules (90s)

**Say:** "Now James is furious and demanding a refund. This triggers our Safety Agent."

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111000003",
    "customer_name": "James",
    "message": "I am absolutely furious. My cake was completely wrong and I want a full refund immediately.",
    "image_url": null,
    "conversation_id": "wa_conv_126"
  }' | jq '{intent, severity: .complaint.severity, escalated: .complaint.requires_escalation, owner_task_priority: .owner_task.priority, reply}'
```

**Point out:**
- `severity: "high"` — Manus analysis detected hostile tone
- `requires_escalation: true` — owner must handle this manually
- `owner_task_priority: "urgent"` — task created for the owner dashboard
- `reply` — safe holding message, **not** an automatic refund approval

---

## 6. Dashboard (30s)

**Say:** "Finally, the owner can see a summary of everything that's happened."

```bash
curl http://localhost:3001/dashboard/summary?business_id=demo_luna_bakery | jq
```

**Point out:** messages, orders, complaints, open tasks, top products.

---

## What's next (30s)

- Plug in **Wassist** for real WhatsApp delivery → `wassistAdapter.stub.ts`
- Plug in **PayPal sandbox** for real checkout → `paypalAdapter.stub.ts`
- Connect **Supabase** for persistent storage → set `SUPABASE_URL` in `.env`
- Connect **Manus AI** for better sentiment analysis → set `MANUS_API_KEY` in `.env`
- Add the **Next.js dashboard** → `apps/web/`
