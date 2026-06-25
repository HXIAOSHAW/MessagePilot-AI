#!/usr/bin/env bash
# scripts/demo_supabase_order_flow.sh
#
# Tests a complete order flow with DATA_MODE=supabase and SUPABASE_STRICT=true.
# Verifies the response contains all data-source visibility fields and that
# the order was truly written to Supabase.
#
# Usage (env vars must be set in your shell or .env):
#   DATA_MODE=supabase SUPABASE_STRICT=true bash scripts/demo_supabase_order_flow.sh
#
# To run in mock mode (no Supabase needed):
#   bash scripts/demo_supabase_order_flow.sh
#
# The script PASSES if all asserted fields match expected values.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"

STRICT="${SUPABASE_STRICT:-false}"
DATA_MODE_VAL="${DATA_MODE:-memory}"

echo "══════════════════════════════════════════════════════════════════"
echo "  MessagePilot AI — Supabase Order Flow Demo"
echo "  Base URL:  ${BASE_URL}"
echo "  DATA_MODE: ${DATA_MODE_VAL}"
echo "  STRICT:    ${STRICT}"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# ── Check server is up ────────────────────────────────────────────────────────
echo "── Health check ──────────────────────────────────────────────────"
HEALTH=$(curl -s "${BASE_URL}/health")
STATUS=$(echo "${HEALTH}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "error")
if [[ "${STATUS}" != "ok" ]]; then
  echo "❌  Server not healthy (got: ${STATUS})"
  echo "    Start the backend with: pnpm --filter backend dev"
  exit 1
fi
echo "   ✓ Server is up"
echo ""

# ── Send order message ────────────────────────────────────────────────────────
echo "── Sending order message ─────────────────────────────────────────"
MESSAGE="Hi, I want to order a chocolate birthday cake for Friday pickup."
echo "   Message: \"${MESSAGE}\""
echo ""

curl -s -o /tmp/mp_order_response.json -w "" \
  -X POST "${BASE_URL}/agent/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"${MESSAGE}\",
    \"customer_phone\": \"+447700000001\",
    \"customer_name\": \"Demo Customer\",
    \"business_id\": \"demo_luna_bakery\",
    \"conversation_id\": \"demo-supabase-$(date +%s)\"
  }"

echo "── Raw response ──────────────────────────────────────────────────"
python3 -m json.tool /tmp/mp_order_response.json 2>/dev/null || cat /tmp/mp_order_response.json
echo ""

# ── Assert expected fields ────────────────────────────────────────────────────
echo "── Assertions ────────────────────────────────────────────────────"

python3 - <<PYEOF
import json, sys

with open("/tmp/mp_order_response.json") as f:
    r = json.load(f)

passed = True

def check(label, actual, expected):
    global passed
    ok = actual == expected
    mark = "✓" if ok else "✗"
    print(f"  [{mark}] {label}: {repr(actual)}", end="")
    if not ok:
        print(f"  (expected: {repr(expected)})", end="")
        passed = False
    print()

def check_truthy(label, actual):
    global passed
    ok = bool(actual)
    mark = "✓" if ok else "✗"
    print(f"  [{mark}] {label}: {repr(actual)}", end="")
    if not ok:
        print(f"  (expected: non-empty/non-null)", end="")
        passed = False
    print()

def check_empty(label, actual):
    global passed
    ok = not actual
    mark = "✓" if ok else "✗"
    print(f"  [{mark}] {label}: {repr(actual)}", end="")
    if not ok:
        print(f"  (expected: empty)", end="")
        passed = False
    print()

DATA_MODE = "${DATA_MODE_VAL}"
STRICT     = "${STRICT}" == "true"

check("intent", r.get("intent"), "order")
check("conversation_state", r.get("conversation_state"), "awaiting_payment")
check_truthy("order_id", r.get("order_id"))
check_truthy("checkout_url", r.get("checkout_url"))
check_empty("missing_fields", r.get("missing_fields", []))
check("data_mode", r.get("data_mode"), DATA_MODE)

if DATA_MODE == "supabase":
    check("product_lookup_source", r.get("product_lookup_source"), "supabase")
    if STRICT:
        check("fallback_used", r.get("fallback_used"), False)
    check("supabase_order_created", r.get("supabase_order_created"), True)
else:
    check("product_lookup_source", r.get("product_lookup_source"), "memory")
    check("supabase_order_created", r.get("supabase_order_created"), False)

print()
if passed:
    print("✅  All assertions passed.")
else:
    print("❌  Some assertions failed — see above.")
    sys.exit(1)
PYEOF
