# MessagePilot AI

> **MessagePilot AI is not just a chatbot. It is a message-based business operating loop. Customers send normal WhatsApp messages. Manus interprets the business intent. The backend validates safety and executes allowed actions. PayPal enables checkout. Supabase records the operating memory. Wassist delivers the customer conversation.**

Built at the Cursor Hackathon — June 2026.

---

## What it does

MessagePilot AI is a message-based business agent for small WordPress and WooCommerce shops. It turns customer WhatsApp messages into real business actions — automatically.

| Customer message | What MessagePilot does |
|---|---|
| "I want a chocolate birthday cake for Friday pickup" | Creates a draft order + PayPal checkout link + sends reply |
| "My cake arrived damaged and I want a refund" | Creates complaint case + owner task + sends safe reply (no auto-refund) |
| "How much is the vanilla cake?" | Answers with the price from the product catalog |
| "I need to speak to a real person" | Flags for human handover |

---

## How the agent flow works

```
Customer WhatsApp message
        │
        ▼
   Wassist                 ← WhatsApp message interface (stub ready)
        │  POST /agent/message
        ▼
   MessagePilot Backend    ← Express + TypeScript + Zod validation
        │
        ▼
   Manus AI                ← Main reasoning agent: intent, sentiment, reply draft
        │                     (mock heuristics when MANUS_API_KEY not set)
        ▼
   Safety Agent            ← Backend validates: blocks refund/legal/health auto-replies
        │
   ┌────┴────┐
   ▼         ▼
Order       Complaint
Agent       Agent
   │              │
   ▼              ▼
PayPal        Owner Task    ← Owner reviews high-risk cases
checkout      (Supabase)
   │
   ▼
Supabase      ← Stores messages, orders, complaints, tasks, logs
```

---

## What each tool does

| Tool | Role |
|---|---|
| **Wassist** | WhatsApp customer message interface — sends messages in, receives replies out |
| **Manus AI** | Main reasoning agent — interprets business intent, analyses sentiment, drafts reply |
| **PayPal Sandbox** | Checkout and payment — order only confirmed after `/payment/status` webhook fires |
| **Supabase** | Business memory — stores everything: messages, orders, complaints, tasks, logs |
| **Backend** | Safety validation and action execution — nothing runs without backend approval |

---

## Demo business

**Luna Bakery London** — a real example business used in all demo flows.

Products: Chocolate Birthday Cake (£29) · Vanilla Birthday Cake (£25) · Cupcake Box (£18)

---

## Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8 (`npm i -g pnpm`)

---

## Install

```bash
pnpm install
```

---

## Configure

```bash
cp .env.example .env
```

Leave all credentials blank. The backend runs entirely in **mock mode** — no external accounts needed for the demo.

| Blank env var | What runs instead |
|---|---|
| `MANUS_API_KEY` | Mock keyword-based reasoning |
| `WASSIST_API_KEY` | Console-logged replies |
| `PAYPAL_CLIENT_ID` | Mock checkout URL |
| `SUPABASE_URL` | In-memory store (resets on restart) |

---

## Run the backend

```bash
pnpm dev:backend
# → http://localhost:3001
```

```bash
curl http://localhost:3001/health
```

---

## Run the demo flows

**Order demo** — complete order → checkout URL:
```bash
bash scripts/demo_order_flow.sh
```

**Complaint demo** — complaint case → owner task + safe reply:
```bash
bash scripts/demo_complaint_flow.sh
```

**Full agent core demo** — all 7 canonical test cases:
```bash
bash scripts/demo_agent_core.sh
```

Or manually:
```bash
# Order
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000000",
    "customer_name": "Sarah",
    "message": "I want to order a chocolate birthday cake for Friday pickup",
    "image_url": null,
    "conversation_id": "wa_conv_123"
  }'

# Complaint
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111111111",
    "customer_name": "James",
    "message": "My cake arrived with the wrong name and the party is tonight. I am really upset.",
    "image_url": null,
    "conversation_id": "wa_conv_456"
  }'
```

---

## Dashboard summary

```bash
curl "http://localhost:3001/dashboard/summary?business_id=demo_luna_bakery"
```

---

## Monorepo layout

```
messagepilot-ai/
├── apps/
│   ├── backend/       Express API + agents (TypeScript)
│   └── web/           Next.js dashboard (placeholder)
├── packages/
│   └── shared/        Zod schemas, types, constants
├── datasets/          Demo data — Luna Bakery London
├── supabase/          SQL schema + seed (ready to use)
├── scripts/           Demo shell scripts
└── docs/              Architecture, API contract, demo script, work plan
```

---

## Team integration points

### Connect Wassist (WhatsApp)
1. Open `apps/backend/src/adapters/wassistAdapter.stub.ts`
2. Implement the `MessagingAdapter` interface
3. Set `WASSIST_API_KEY`, `WASSIST_PHONE_NUMBER_ID` in `.env`

### Connect PayPal Sandbox
1. Open `apps/backend/src/adapters/paypalAdapter.stub.ts`
2. Implement the `PaymentAdapter` interface
3. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` in `.env`

### Connect Manus AI
1. Open `apps/backend/src/services/manusService.ts`
2. Implement `callManusApi()`
3. Set `MANUS_API_KEY` in `.env` — the service switches automatically

### Connect Supabase
1. Run `supabase/schema.sql` in your Supabase project
2. Run `supabase/seed.sql` for demo data
3. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`

---

## API reference

→ [`docs/api_contract.md`](docs/api_contract.md)

## Architecture

→ [`docs/architecture.md`](docs/architecture.md)

## Team work plan

→ [`docs/team_workplan.md`](docs/team_workplan.md)

---

## License

MIT
