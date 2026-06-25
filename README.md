# MessagePilot AI

> **MessagePilot AI is not just a chatbot. It is a message-based business operating loop. Customers send normal WhatsApp messages. Manus interprets the business intent. The backend validates safety and executes allowed actions. PayPal enables checkout. Supabase records the operating memory. Wassist delivers the customer conversation.**

Built at the Cursor Hackathon — June 2026.

---

## What it does

MessagePilot AI is a message-based business agent for small WordPress and WooCommerce shops. It turns customer WhatsApp messages into real business actions — automatically.

| Customer message | What MessagePilot does |
|---|---|
| "I want a chocolate birthday cake for Friday pickup" | Creates a draft order + PayPal checkout link + sends reply |
| "My cake arrived damaged and I want a refund" | Manus assesses severity → auto-resolves or auto-refunds small low-risk cases (≤ £30), otherwise escalates with an owner task + sends a safe reply |
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
     Router               ← Classifies intent (order / complaint / question / handover)
   ┌────┴────┐
   ▼         ▼
Order       Complaint Agent
Agent          │
   │           ▼
   │        Manus AI       ← Reasons about the complaint, returns a structured
   │           │             decision (severity, action, reply). Deterministic
   │           │             fallback when MANUS_API_KEY is unset or Manus fails.
   │           ▼
   │        Guardrails     ← Backend enforces policy before acting:
   │           │             auto-refund only ≤ £30 & low severity & real order;
   │           │             medium/high, legal/health → escalate, never admit fault
   ▼           ▼
PayPal      Refund / Owner Task
checkout    (Owner reviews escalated cases)
   │           │
   ▼           ▼
Supabase      ← Stores messages, orders, complaints, tasks, logs, events
```

---

## What each tool does

| Tool | Role |
|---|---|
| **Wassist** | WhatsApp customer message interface — sends messages in, receives replies out |
| **Manus AI** | Complaint agent brain — reasons about the complaint and returns a structured decision (severity, action, reply) via the Manus v2 API |
| **PayPal Sandbox** | Checkout and payment — order only confirmed after `/payment/status` webhook fires; also processes guardrailed refunds |
| **Supabase** | Business memory — stores everything: messages, orders, complaints, tasks, logs, events |
| **Backend** | Safety validation and action execution — enforces guardrails on Manus's decisions; nothing runs without backend approval |

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

| Blank / unset env var | What runs instead |
|---|---|
| `MANUS_API_KEY` | Deterministic complaint fallback (heuristic severity + safe escalation) |
| `WASSIST_API_KEY` | Console-logged replies |
| `PAYPAL_CLIENT_ID` | Mock checkout URL + mock refunds |
| `DATA_MODE` (≠ `supabase`) | In-memory store (resets on restart) |

To go live, set `MANUS_API_KEY` to enable the real Manus-powered complaint agent, and set `DATA_MODE=supabase` with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to persist to Supabase.

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
The complaint agent already talks to the live **Manus v2 API** (`apps/backend/src/services/manusService.ts`).
1. Get a key at [open.manus.ai](https://open.manus.ai) (Authentication)
2. Set `MANUS_API_KEY` in `.env` (optionally tune `MANUS_AGENT_PROFILE`, `MANUS_POLL_TIMEOUT_MS`)
3. The agent switches on automatically; if Manus is unset or fails, it falls back to a deterministic flow. Decisions are always re-validated by backend guardrails before any refund/escalation.

### Connect Supabase
1. Run `supabase/schema.sql` in your Supabase project (creates `messages`, `orders`, `complaints`, `owner_tasks`, `agent_logs`, `events`)
2. Run `supabase/seed.sql` for demo data
3. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and `DATA_MODE=supabase` in `.env` (the service-role key bypasses RLS for server-side writes)

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
