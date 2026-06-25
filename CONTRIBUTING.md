# Contributing to OrderPilot AI

Thank you for helping! This guide covers the conventions used in this hackathon project.

---

## Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Stable demo-ready code |
| `feat/<name>` | New feature |
| `fix/<name>` | Bug fix |
| `data/<name>` | Dataset / catalog additions |

Open a PR against `main`. Keep PRs small and focused.

---

## Commit style

```
feat: add retry logic to Order Agent
fix: complaint severity always defaulting to low
data: add Luna Bakery seasonal catalog
docs: update API contract with payment/status
```

---

## Code conventions

- TypeScript strict mode everywhere
- Zod for all external input validation
- No `any` — use `unknown` and narrow
- Functions over classes for agents and services
- Keep each file under ~150 lines; split if larger
- No credentials in source — use `.env`

---

## Adding a new agent

1. Create `apps/backend/src/agents/myAgent.ts`
2. Export a single `async function runMyAgent(ctx: AgentContext): Promise<AgentResult>`
3. Register the intent in `apps/backend/src/agents/routerAgent.ts`
4. Add test messages to `datasets/test_messages/`

---

## Running lint + typecheck

```bash
pnpm typecheck
```

---

## Questions?

Open an issue or ping the team on WhatsApp 😄
