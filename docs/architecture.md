# MessagePilot AI — Architecture

## The operating loop

```
Customer WhatsApp message
        │
        ▼
   Wassist                         ← WhatsApp message interface
        │  POST /agent/message
        ▼
   MessagePilot Backend            ← Express + TypeScript
        │  Zod validation
        ▼
   Manus AI (ManusService)         ← Main reasoning agent
        │                             intent · sentiment · reply draft · severity
        │                             mock heuristics when MANUS_API_KEY not set
        ▼
   Safety Agent                    ← Backend validates Manus output
        │                             blocks: refund · legal · health/safety
        │                             no business action runs without this check
        │
   ┌────┴────────────────┐
   ▼                     ▼
Order Agent          Complaint Agent
   │                     │
   ├── CatalogService     ├── ManusService (severity)
   ├── slot extraction    ├── SafetyAgent (blocked topics)
   └── draft order        └── OwnerTaskService (escalation)
        │
        ▼
   PaymentAdapter
        │  createCheckout()
        ▼
   MockPaymentAdapter    ← demo: fake checkout URL
   PayPalAdapter.stub    ← connect PayPal Sandbox here
        │
        ▼
   POST /payment/status  ← PayPal webhook fires when customer pays
        │                   order only confirmed after this
        ▼
   Supabase / mock store ← messages · orders · complaints · tasks · logs
        │
        ▼
   MessagingAdapter
        │  sendMessage(reply_text)
        ▼
   MockMessagingAdapter  ← demo: logs to console
   WassistAdapter.stub   ← connect Wassist here
        │
        ▼
   Wassist               ← delivers reply to customer on WhatsApp
```

---

## Tool roles

| Tool | Role |
|---|---|
| **Wassist** | WhatsApp customer message interface — delivers inbound messages and sends outbound replies |
| **Manus AI** | Main reasoning agent — interprets business intent, analyses sentiment, drafts the customer reply |
| **PayPal Sandbox** | Checkout and payment simulation — order is only marked confirmed after the `/payment/status` webhook fires |
| **Supabase** | Business memory, state and analytics — stores every message, order, complaint, task and agent log |
| **Backend** | Safety validation and action execution — every Manus output is checked before any action runs |

---

## Adapter pattern

All external integrations are hidden behind interfaces. The factory functions pick mock or real automatically based on env vars.

| Interface | Demo (mock) | Real integration |
|---|---|---|
| `MessagingAdapter` | `MockMessagingAdapter` | `wassistAdapter.stub.ts` → set `WASSIST_API_KEY` |
| `PaymentAdapter` | `MockPaymentAdapter` | `paypalAdapter.stub.ts` → set `PAYPAL_CLIENT_ID` |

---

## Manus positioning

```
                    ┌─────────────────────┐
                    │     Manus AI         │
                    │  (reasoning layer)   │
                    │                     │
                    │  - intent           │
                    │  - sentiment        │
                    │  - severity score   │
                    │  - reply draft      │
                    │  - escalate flag    │
                    └──────────┬──────────┘
                               │  ManusAnalysisResult
                               ▼
                    ┌─────────────────────┐
                    │   Safety Agent       │
                    │  (backend layer)     │
                    │                     │
                    │  validates output   │
                    │  blocks blocked     │
                    │  topics             │
                    │  forces escalation  │
                    └──────────┬──────────┘
                               │  safe to execute
                               ▼
                    business action (order / complaint / task)
```

Manus thinks. Backend validates. Nothing executes without safety approval.

---

## Safety rules

The Safety Agent runs on every message before any business action:

- **Never** auto-approve a refund
- **Never** acknowledge legal liability
- **Never** promise compensation
- **Never** auto-resolve health/safety issues (allergy, injury, food poisoning)
- Angry or hostile messages → always human-reviewed
- High-severity complaints → always create an OwnerTask

---

## Storage

| Mode | How to activate | What happens |
|---|---|---|
| In-memory mock | Default (no env vars needed) | Data lives in RAM, resets on restart — safe for demos |
| Supabase | Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Run `supabase/schema.sql` first, then `seed.sql` |

---

## Agent functions

Each agent is a pure async function — easy to test and extend:

```typescript
async function runOrderAgent(ctx: AgentContext): Promise<AgentResult>
async function runComplaintAgent(ctx: AgentContext): Promise<AgentResult>
```

`AgentContext` — message, customer info, business catalog  
`AgentResult` — reply text, created order/complaint/task, extracted slots, safety flags
