# OrderPilot AI — Team Work Plan

_Hackathon — June 2026_

---

## Current status ✅

- [x] Monorepo structure
- [x] Shared types, Zod schemas, constants
- [x] Express backend with all 4 endpoints
- [x] Router Agent (intent classification)
- [x] Order Agent (extraction + checkout URL)
- [x] Complaint Agent (severity + safety + escalation)
- [x] Safety Agent (blocks refund/legal/health auto-replies)
- [x] Mock messaging and payment adapters
- [x] Wassist and PayPal adapter stubs
- [x] In-memory mock store + Supabase repository stubs
- [x] Manus AI service (mock + real API stub)
- [x] Luna Bakery demo data + test messages
- [x] Supabase SQL schema + seed
- [x] Demo shell scripts
- [x] Docs: architecture, API contract, demo script

---

## Open tasks

### Priority 1 — Demo readiness

| Task | Owner | Notes |
|---|---|---|
| Run `pnpm install` and fix any dependency issues | Everyone | Check Node version ≥ 18 |
| Run `bash scripts/demo_order_flow.sh` end-to-end | Everyone | Fix any runtime errors |
| Run `bash scripts/demo_complaint_flow.sh` end-to-end | Everyone | Check safety rules fire correctly |
| Test all 5 order test messages from `datasets/test_messages/order_messages.json` | — | |
| Test all 5 complaint test messages from `datasets/test_messages/complaint_messages.json` | — | |

### Priority 2 — Integration

| Task | Owner | Notes |
|---|---|---|
| Implement `wassistAdapter.stub.ts` | — | Needs WASSIST_API_KEY |
| Implement `paypalAdapter.stub.ts` | — | Needs PAYPAL_CLIENT_ID |
| Wire real Supabase client in `supabase.ts` | — | Needs SUPABASE_URL |
| Connect Manus AI in `manusService.ts` | — | Needs MANUS_API_KEY |

### Priority 3 — Web dashboard

| Task | Owner | Notes |
|---|---|---|
| Build Next.js dashboard | — | See `apps/web/` skeleton |
| Display open owner tasks | — | `GET /dashboard/summary` |
| Show order list with status | — | |
| Show complaint list with severity badges | — | |

### Priority 4 — Improvements

| Task | Owner | Notes |
|---|---|---|
| Replace keyword router with LLM classifier | — | See TODO in `routerAgent.ts` |
| Add multi-turn conversation handling | — | See `stateService.ts` |
| Add webhook signature verification to `/payment/status` | — | |
| Add more test messages to dataset | — | `datasets/test_messages/` |
| Add more businesses to demo data | — | `datasets/demo_businesses/` |

---

## How to add a new agent

1. Create `apps/backend/src/agents/myAgent.ts`
2. Export `async function runMyAgent(ctx: AgentContext): Promise<AgentResult>`
3. Add a new `Intent` value to `packages/shared/src/types.ts`
4. Add detection keywords to `packages/shared/src/constants.ts`
5. Register in `routerAgent.ts` keyword scoring
6. Dispatch in `routes/agent.ts`
7. Add test messages to `datasets/test_messages/`
