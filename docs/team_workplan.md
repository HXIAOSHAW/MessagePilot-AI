# OrderPilot AI — Team Work Plan

_Hackathon — June 2026 · Four workstreams, one evening_

---

## How we work

- One branch per workstream (see naming rules below)
- PR into `main` — small, focused, demo-ready
- Check the PR checklist before asking for review
- No real credentials in any file — mock mode works for everything

---

## Workstream 1 — Dataset

**Goal:** Give the agents realistic test inputs and expected outputs so the team can iterate fast without waiting for live WhatsApp messages.

### What to contribute

| Deliverable | File | Notes |
|---|---|---|
| Product catalog | `datasets/catalog/<business_id>_catalog.json` | id, name, price_gbp, description, available |
| Business profile | `datasets/demo_businesses/<business_id>.json` | name, owner_phone, hours, fulfillment options |
| Realistic order messages | `datasets/test_messages/order_messages.json` | 10+ varied phrasings |
| Realistic complaint messages | `datasets/test_messages/complaint_messages.json` | Cover low / medium / high severity |
| Mixed intent messages | `datasets/test_messages/mixed_messages.json` | Edge cases: ambiguous, emoji-only, multi-intent |
| `expected_intent` label on every message | Same files | `order \| complaint \| product_question \| human_handover \| unknown` |
| `expected_severity` on complaint messages | Same files | `low \| medium \| high` |
| `expected_behaviour` note on edge cases | Same files | Free text — what should the agent do? |

### Files

```
datasets/
  demo_businesses/
    luna_bakery.json          ✅ done — extend or add new businesses
  catalog/
    demo_luna_bakery_catalog.json   ✅ done — add products / seasonal items
  test_messages/
    order_messages.json       ✅ 5 cases — add 10+ more
    complaint_messages.json   ✅ 5 cases — add more severity/safety edge cases
    mixed_messages.json       ✅ 5 cases — add more
```

### Branch

```
feature/dataset-demo-cases
```

### Done when

- At least 10 order messages covering: simple order, missing date, missing product, delivery vs pickup, inscription request, multi-item order
- At least 10 complaint messages covering: wrong product, damage, late delivery, refund demand, health/safety, legal threat
- Every message has `expected_intent` and (for complaints) `expected_severity`

---

## Workstream 2 — Order Agent

**Goal:** Make the Order Agent reliably extract what the customer wants, ask for missing details, build a draft order, and return a checkout link.

### What to contribute

| Area | File |
|---|---|
| Product matching (fuzzy name + keyword) | `apps/backend/src/agents/orderAgent.ts` |
| Slot filling: product, quantity, fulfillment, date, notes | `apps/backend/src/agents/orderAgent.ts` |
| Draft order creation | `apps/backend/src/agents/orderAgent.ts` |
| Payment adapter call | `apps/backend/src/adapters/paymentAdapter.ts` |
| Mock checkout URL | `apps/backend/src/adapters/mockPaymentAdapter.ts` |
| Catalog service improvements | `apps/backend/src/services/catalogService.ts` |
| Customer reply quality | `apps/backend/src/agents/orderAgent.ts` |

### Files

```
apps/backend/src/
  agents/orderAgent.ts          ✅ done — improve extraction + reply quality
  services/catalogService.ts    ✅ done — improve fuzzy matching
  adapters/paymentAdapter.ts    ✅ done — interface stable
  adapters/mockPaymentAdapter.ts ✅ done — returns fake checkout URL
```

### Branch

```
feature/order-agent
```

### Done when

- All 10+ order test messages produce the correct intent
- Incomplete messages (missing date, unknown product) produce a clear follow-up question
- Complete messages produce: draft order object + checkout URL + friendly reply
- No crashes on edge-case input

### Key rules

- Never create a confirmed order without a checkout URL
- Never guess a price — always use the catalog
- Always ask for the pickup/delivery date before creating an order

---

## Workstream 3 — Complaint Agent

**Goal:** Make the Complaint Agent safely handle every complaint severity level — giving empathetic low-risk replies and always escalating high-risk cases to the owner.

### What to contribute

| Area | File |
|---|---|
| Complaint extraction (issue, ref, outcome, evidence) | `apps/backend/src/agents/complaintAgent.ts` |
| Severity classification | `apps/backend/src/agents/complaintAgent.ts` |
| Safety rules (blocked topics) | `apps/backend/src/agents/safetyAgent.ts` |
| Manus AI analysis adapter | `apps/backend/src/services/manusService.ts` |
| Owner escalation task creation | `apps/backend/src/services/ownerTaskService.ts` |
| Safe customer reply generation | `apps/backend/src/agents/complaintAgent.ts` |

### Files

```
apps/backend/src/
  agents/complaintAgent.ts    ✅ done — improve extraction + reply quality
  agents/safetyAgent.ts       ✅ done — extend blocked topic list if needed
  services/manusService.ts    ✅ done — real Manus call stub ready
  services/ownerTaskService.ts ✅ done — task creation working
```

### Branch

```
feature/complaint-agent
```

### Done when

- Low/medium complaints return empathetic reply without escalation
- All safety-blocked topics (refund, legal, health/safety) trigger owner escalation
- High-severity complaints always create an owner task with priority `urgent`
- The safe reply **never** promises a refund, compensation, or resolution outcome
- All 10+ complaint test messages produce the correct severity and escalation flag

### Key safety rules — never break these

- Never auto-approve a refund
- Never acknowledge legal liability
- Never promise compensation
- Never auto-resolve health/safety issues
- High-severity always → owner task

---

## Workstream 4 — Interface & Integration

**Goal:** Build the owner dashboard, plug in Wassist for real WhatsApp delivery, and connect PayPal sandbox for real checkouts.

### What to contribute

| Area | File |
|---|---|
| Dashboard UI (Next.js) | `apps/web/src/app/` |
| Wassist WhatsApp adapter | `apps/backend/src/adapters/wassistAdapter.stub.ts` |
| PayPal sandbox adapter | `apps/backend/src/adapters/paypalAdapter.stub.ts` |
| Demo screens / screenshots | `docs/` or `apps/web/public/` |
| API contract updates | `docs/api_contract.md` |

### Files

```
apps/web/
  src/app/page.tsx              ✅ placeholder — build dashboard here
  src/app/layout.tsx            ✅ done
  src/lib/api.ts                ✅ done — getDashboardSummary, sendAgentMessage

apps/backend/src/adapters/
  wassistAdapter.stub.ts        ✅ interface + TODOs ready — implement here
  paypalAdapter.stub.ts         ✅ interface + TODOs ready — implement here
```

### Branch

```
feature/wassist-paypal-interface
```

### Dashboard pages to build

- `/` — summary cards (messages / orders / complaints / open tasks)
- `/orders` — order list with status badges
- `/complaints` — complaint list with severity badges + safe reply preview
- `/tasks` — open owner tasks sorted by priority

### Done when

- Dashboard loads data from `GET /dashboard/summary`
- At least summary cards and open task list are visible
- OR: Wassist + PayPal adapters are implemented and tested in sandbox

### Integration notes

- Set `WASSIST_API_KEY` etc. in `.env` to activate Wassist (mock used otherwise)
- Set `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` to activate PayPal sandbox
- See TODO comments in each adapter stub for exact implementation steps

---

## Branch naming

| Pattern | Use for |
|---|---|
| `feature/dataset-demo-cases` | New test messages, catalog entries, business profiles |
| `feature/order-agent` | Order Agent improvements |
| `feature/complaint-agent` | Complaint Agent improvements |
| `feature/wassist-paypal-interface` | Dashboard UI, Wassist, PayPal |
| `fix/<short-description>` | Bug fixes |
| `docs/<short-description>` | Documentation only |

---

## PR checklist

See `.github/PULL_REQUEST_TEMPLATE.md` — always fill it in before requesting review.

---

## Current status

| Workstream | Status | Next step |
|---|---|---|
| Dataset | 🟡 5 messages each | Add 10+ order + 10+ complaint messages |
| Order Agent | 🟡 Core working | Improve extraction, more edge-case handling |
| Complaint Agent | 🟡 Core working | Improve reply quality, extend safety rules |
| Interface & Integration | 🔴 Placeholder only | Build dashboard UI or plug in Wassist/PayPal |
