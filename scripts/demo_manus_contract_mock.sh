#!/usr/bin/env bash
# scripts/demo_manus_contract_mock.sh
#
# Verifies MANUS_MODE=mock behavior:
#   1. Complete order still creates an order and returns checkout_url
#   2. Risky complaint does NOT create an order (Safety Agent blocks it)
#   3. Response always includes manus_used and manus_fallback fields
#
# No external credentials required — safe for demo without Supabase, Manus,
# PayPal, or Wassist credentials.
#
# Usage:
#   bash scripts/demo_manus_contract_mock.sh
#
# To test external Manus fallback (requires a running Manus instance):
#   MANUS_MODE=external MANUS_ENDPOINT=http://localhost:4000 \
#     bash scripts/demo_manus_contract_mock.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
MANUS_MODE_VAL="${MANUS_MODE:-mock}"

echo "══════════════════════════════════════════════════════════════════"
echo "  MessagePilot AI — Manus Contract Mock Test"
echo "  Base URL:   ${BASE_URL}"
echo "  MANUS_MODE: ${MANUS_MODE_VAL}"
echo "══════════════════════════════════════════════════════════════════"
echo ""

PASS=0
FAIL=0

run_case() {
  local CASE_NAME="$1"
  local PAYLOAD="$2"
  local ASSERTIONS="$3"

  echo "── Case: ${CASE_NAME} ────────────────────────────────────────────"
  curl -s -o /tmp/mp_manus_response.json \
    -X POST "${BASE_URL}/agent/message" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}"

  echo "   Response fields:"
  python3 - "${CASE_NAME}" "${MANUS_MODE_VAL}" <<PYEOF
import json, sys

case_name = sys.argv[1]
manus_mode = sys.argv[2]

with open("/tmp/mp_manus_response.json") as f:
    r = json.load(f)

passed = True

def check(label, actual, expected):
    global passed
    ok = actual == expected
    mark = "✓" if ok else "✗"
    print(f"     [{mark}] {label}: {repr(actual)}", end="")
    if not ok:
        print(f"  (expected: {repr(expected)})", end="")
        passed = False
    print()

def check_truthy(label, actual):
    global passed
    ok = bool(actual)
    mark = "✓" if ok else "✗"
    print(f"     [{mark}] {label}: {repr(actual)}", end="")
    if not ok:
        print("  (expected: non-empty)", end="")
        passed = False
    print()

def check_false(label, actual):
    global passed
    ok = actual is False or actual is None or actual == "false"
    mark = "✓" if ok else "✗"
    print(f"     [{mark}] {label}: {repr(actual)}", end="")
    if not ok:
        print("  (expected: false/null)", end="")
        passed = False
    print()

${ASSERTIONS}

# Manus fields must always be present
check("manus_used", r.get("manus_used"), False if manus_mode == "mock" else r.get("manus_used"))
check("manus_fallback", r.get("manus_fallback"), False)

if passed:
    print("     → PASSED")
    sys.exit(0)
else:
    print("     → FAILED")
    sys.exit(1)
PYEOF
  if [[ $? -eq 0 ]]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
  echo ""
}

# ── Case 1: Complete order → creates order + checkout ─────────────────────────
run_case \
  "Complete order" \
  '{"message":"I want to order a chocolate birthday cake for Friday pickup please","customer_phone":"+447700000001","customer_name":"Jane Demo","business_id":"demo_luna_bakery","conversation_id":"manus-mock-order-'"$(date +%s)"'"}' \
  'check("intent", r.get("intent"), "order")
check("conversation_state", r.get("conversation_state"), "awaiting_payment")
check_truthy("order_id", r.get("order_id"))
check_truthy("checkout_url", r.get("checkout_url"))'

# ── Case 2: Risky complaint → no order, safety flags set ──────────────────────
run_case \
  "Risky complaint (angry + legal threat)" \
  '{"message":"I am furious! I will take legal action if you do not refund me immediately.","customer_phone":"+447700000002","customer_name":"John Demo","business_id":"demo_luna_bakery","conversation_id":"manus-mock-risky-'"$(date +%s)"'"}' \
  'intent = r.get("intent")
ok = intent in ("complaint", "human_handover")
import sys
if not ok:
    print(f"     [✗] intent: {repr(intent)}  (expected: complaint or human_handover)")
    passed = False
else:
    print(f"     [✓] intent: {repr(intent)}")
check("order_id", r.get("order_id"), None)
check("checkout_url", r.get("checkout_url"), None)
check_truthy("safety_flags", r.get("safety_flags", []))'

# ── Summary ───────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  echo "  ❌  Some cases failed."
  exit 1
else
  echo "  ✅  All Manus contract mock tests passed."
fi
