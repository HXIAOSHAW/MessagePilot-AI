# OrderPilot AI — Architecture

## Overview

```
WhatsApp (customer)
        │
        ▼
  [Wassist Adapter]           ← mock by default; plug in real Wassist later
        │
        ▼
  POST /agent/message         ← Express route (Zod-validated)
        │
        ▼
  [Router Agent]              ← keyword scoring → intent classification
        │
    ┌───┴───────────────────┐
    ▼                       ▼
[Order Agent]        [Complaint Agent]
    │                       │
    │   ┌───────────────────┘
    │   │
    ▼   ▼
[Safety Agent]              ← blocks refund/legal/health auto-replies
    │
    ▼
[Services layer]
  ├── CatalogService         ← reads catalog JSON, fuzzy product match
  ├── StateService           ← per-conversation turn memory (in-memory)
  ├── OwnerTaskService       ← creates escalation tasks
  └── ManusService           ← AI analysis (mock or real Manus API)
    │
    ▼
[Adapters]
  ├── MessagingAdapter       ← sendMessage() to WhatsApp (mock/Wassist)
  └── PaymentAdapter         ← createCheckout() (mock/PayPal)
    │
    ▼
[Database layer]
  ├── Supabase client        ← real if env vars set, mock store otherwise
  └── Repositories           ← save/query orders, complaints, tasks, logs
```

## Adapter pattern

All external integrations are hidden behind clean interfaces:

| Interface | Mock | Real (stub) |
|---|---|---|
| `MessagingAdapter` | `MockMessagingAdapter` | `wassistAdapter.stub.ts` |
| `PaymentAdapter` | `MockPaymentAdapter` | `paypalAdapter.stub.ts` |

The factory functions (`getMessagingAdapter`, `getPaymentAdapter`) automatically switch between mock and real based on whether the relevant env vars are set.

## Agent execution model

Each agent is a pure async function:

```typescript
async function runOrderAgent(ctx: AgentContext): Promise<AgentResult>
async function runComplaintAgent(ctx: AgentContext): Promise<AgentResult>
```

`AgentContext` contains everything the agent needs: the message, customer details, business catalog.  
`AgentResult` contains the customer reply, any created objects (order/complaint/task), and metadata.

## Safety model

The Safety Agent is applied to every complaint reply before it is sent:

- Any message touching blocked topics (refund, legal, health/safety, compensation) triggers an override reply
- The override reply asks the human owner to follow up
- High-severity cases always create an OwnerTask regardless of topic matching
- No agent ever auto-approves refunds, compensation, legal claims, or health/safety issues

## Storage

- **Mock mode** (default): all data lives in `mockStore` (in-memory Maps). Data is lost on server restart. Safe for demos.
- **Supabase mode**: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Run `supabase/schema.sql` first.
