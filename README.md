# OrderPilot AI 🚀

> A self-running WhatsApp operations agent for small WordPress / WooCommerce businesses.  
> Built at the Cursor Hackathon – June 2026.

---

## What it does

Two core backend agents handle every incoming WhatsApp message automatically:

| Agent | Trigger | Output |
|---|---|---|
| **Order Agent** | Customer wants to buy something | Draft order + checkout URL + owner task |
| **Complaint Agent** | Customer has a problem | Structured case + severity + safe reply + optional owner escalation |

A **Router Agent** classifies every inbound message and dispatches it to the right specialist.  
A **Safety Agent** ensures no reply ever auto-approves refunds, legal claims, or health-safety issues.

---

## Monorepo layout

```
orderpilot-ai/
├── apps/
│   ├── backend/       Express API + agents (TypeScript)
│   └── web/           Next.js dashboard (TypeScript)
├── packages/
│   └── shared/        Zod schemas, types, constants
├── datasets/          Demo data for Luna Bakery London
├── supabase/          SQL schema + seed
├── scripts/           Demo shell scripts
└── docs/              Architecture, API contract, demo script
```

---

## Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8 (`npm i -g pnpm`)

---

## Install dependencies

```bash
pnpm install
```

---

## Configure environment

```bash
cp .env.example .env
# Edit .env — leave Supabase / Wassist / PayPal / Manus blank for mock mode
```

The backend runs fully in **mock mode** when real credentials are absent. No external accounts are needed for the demo.

---

## Run the backend locally

```bash
pnpm dev:backend
# Server starts on http://localhost:3001
```

Check health:

```bash
curl http://localhost:3001/health
```

---

## Test the order flow

```bash
bash scripts/demo_order_flow.sh
```

Or manually:

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
  }' | jq
```

---

## Test the complaint flow

```bash
bash scripts/demo_complaint_flow.sh
```

Or manually:

```bash
curl -s -X POST http://localhost:3001/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111111111",
    "customer_name": "James",
    "message": "My cake was completely wrong and I am very unhappy. I want a full refund immediately.",
    "image_url": null,
    "conversation_id": "wa_conv_456"
  }' | jq
```

---

## Check dashboard summary

```bash
curl http://localhost:3001/dashboard/summary?business_id=demo_luna_bakery | jq
```

---

## How teammates should contribute

### Adding to the dataset

Edit or add files under `datasets/`:

- `datasets/demo_businesses/` — business profiles
- `datasets/catalog/` — product catalogs
- `datasets/test_messages/` — example WhatsApp messages for testing

### Plugging in Wassist

1. Open `apps/backend/src/adapters/wassistAdapter.stub.ts`
2. Follow the TODO comments to implement the `MessagingAdapter` interface
3. Set `WASSIST_API_KEY` and related env vars in `.env`
4. Update `apps/backend/src/adapters/messagingAdapter.ts` to import your real adapter

### Plugging in PayPal sandbox

1. Open `apps/backend/src/adapters/paypalAdapter.stub.ts`
2. Implement the `PaymentAdapter` interface using the PayPal Orders v2 API
3. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env`
4. Update `apps/backend/src/adapters/paymentAdapter.ts` to import your real adapter

### Improving agents

Agents live in `apps/backend/src/agents/`. Each agent is a pure async function — easy to edit and test.

### Connecting Manus AI

Set `MANUS_API_KEY` in `.env`. The `ManusService` (`apps/backend/src/services/manusService.ts`) will automatically switch from mock analysis to real Manus calls.

---

## API reference

See [`docs/api_contract.md`](docs/api_contract.md).

---

## Architecture

See [`docs/architecture.md`](docs/architecture.md).

---

## License

MIT
