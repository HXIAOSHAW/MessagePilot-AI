#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Demo: Order Agent Core — Router → Order Agent → Safety
#
# Tests the 7 canonical cases for the order-handling workstream.
# All cases use Luna Bakery demo data and mock adapters (no real credentials).
#
# Usage: bash scripts/demo_agent_core.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:3001
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail
BASE="${1:-http://localhost:3001}"
SEP="────────────────────────────────────────────────"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; }
info() { echo -e "${YELLOW}  → $1${NC}"; }

post_msg() {
  local phone="$1" name="$2" msg="$3" conv="$4"
  curl -s -X POST "$BASE/agent/message" \
    -H "Content-Type: application/json" \
    -d "{
      \"business_id\": \"demo_luna_bakery\",
      \"customer_phone\": \"$phone\",
      \"customer_name\": \"$name\",
      \"message\": \"$msg\",
      \"image_url\": null,
      \"conversation_id\": \"$conv\"
    }"
}

check_field() {
  local resp="$1" field="$2" expected="$3"
  local actual
  actual=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$field'); print(str(v))" 2>/dev/null)
  if echo "$actual" | grep -q "$expected"; then
    pass "$field = $actual"
  else
    fail "$field expected '$expected', got '$actual'"
  fi
}

echo ""
echo "🎂 OrderPilot AI — Order Agent Core Demo"
echo "$SEP"

# ── Health check ──────────────────────────────────────────────────────────────

echo ""
echo "Health check..."
STATUS=$(curl -s "$BASE/health" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unreachable")
if [ "$STATUS" = "ok" ]; then
  pass "Backend is up"
else
  fail "Backend not responding at $BASE — run: pnpm dev:backend"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Clear complete order
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 1 — Complete order: chocolate birthday cake, Friday pickup"
echo ""
RESP=$(post_msg "+447000000001" "Sarah" \
  "Hi, I want to order a chocolate birthday cake for Friday pickup." "demo_t1")

check_field "$RESP" "intent"             "order"
check_field "$RESP" "conversation_state" "awaiting_payment"
check_field "$RESP" "missing_fields"     "\[\]"

CHECKOUT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checkout_url','null'))")
if [ "$CHECKOUT" != "null" ] && [ "$CHECKOUT" != "None" ]; then
  pass "checkout_url present: $CHECKOUT"
else
  fail "checkout_url is null — expected a URL"
fi

PRODUCT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['extracted_order']['product_name'])")
pass "extracted product: $PRODUCT"

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:120])")"

# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Incomplete order — missing date and fulfillment
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 2 — Incomplete order: no date, no fulfillment"
echo ""
RESP=$(post_msg "+447000000002" "Tom" "I want a chocolate cake." "demo_t2")

check_field "$RESP" "intent"             "order"
check_field "$RESP" "conversation_state" "awaiting_info"

MISSING=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['missing_fields'])")
if echo "$MISSING" | grep -q "requested_date"; then
  pass "missing_fields includes requested_date: $MISSING"
else
  fail "expected requested_date in missing_fields, got: $MISSING"
fi

CHECKOUT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checkout_url','null'))")
if [ "$CHECKOUT" = "null" ] || [ "$CHECKOUT" = "None" ]; then
  pass "no checkout created (correct — fields missing)"
else
  fail "checkout_url should be null when fields are missing"
fi

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:140])")"

# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Delivery order with quantity
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 3 — Delivery order: two cupcake boxes, tomorrow"
echo ""
RESP=$(post_msg "+447000000003" "Priya" \
  "Can I get two cupcake boxes delivered tomorrow?" "demo_t3")

check_field "$RESP" "intent"             "order"
check_field "$RESP" "conversation_state" "awaiting_payment"

QTY=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['extracted_order']['quantity'])")
METHOD=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['extracted_order']['fulfillment_method'])")
DATE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['extracted_order']['requested_date'])")

if [ "$QTY" = "2" ]; then pass "quantity = $QTY"; else fail "expected quantity=2, got $QTY"; fi
if [ "$METHOD" = "delivery" ]; then pass "fulfillment_method = delivery"; else fail "expected delivery, got $METHOD"; fi
if [ "$DATE" = "Tomorrow" ]; then pass "requested_date = $DATE"; else fail "expected Tomorrow, got $DATE"; fi

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:140])")"

# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Product question — must NOT be order
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 4 — Product question: price enquiry"
echo ""
RESP=$(post_msg "+447000000004" "Lisa" "How much is the vanilla cake?" "demo_t4")

check_field "$RESP" "intent"   "product_question"

CHECKOUT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checkout_url','null'))")
if [ "$CHECKOUT" = "null" ] || [ "$CHECKOUT" = "None" ]; then
  pass "no order created (correct)"
else
  fail "product_question should not create an order"
fi

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:140])")"

# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Complaint must NOT become an order
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 5 — Complaint (damaged + refund): must route to complaint, not order"
echo ""
RESP=$(post_msg "+447000000005" "Rachel" \
  "My chocolate cake arrived damaged and I want a refund." "demo_t5")

check_field "$RESP" "intent"         "complaint"
check_field "$RESP" "requires_human" "True"

SAFETY=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['safety_flags'])")
if echo "$SAFETY" | grep -q "refund\|damaged"; then
  pass "safety_flags triggered: $SAFETY"
else
  fail "expected refund/damaged in safety_flags, got: $SAFETY"
fi

CHECKOUT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checkout_url','null'))")
if [ "$CHECKOUT" = "null" ] || [ "$CHECKOUT" = "None" ]; then
  pass "no checkout created (correct)"
else
  fail "complaint must never create a checkout"
fi

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:140])")"

# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Angry complaint
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 6 — Angry complaint: wrong name, upset"
echo ""
RESP=$(post_msg "+447000000006" "James" \
  "My cake has the wrong name and I am really upset." "demo_t6")

check_field "$RESP" "intent"  "complaint"

REASON=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['router_reason'])")
pass "router_reason: $REASON"

SAFETY=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['safety_flags'])")
pass "safety_flags: $SAFETY"

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:140])")"

# ─────────────────────────────────────────────────────────────────────────────
# Test 7: Ambiguous — ask for clarification
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "$SEP"
echo "TEST 7 — Ambiguous: 'Can you help me with a cake?'"
echo ""
RESP=$(post_msg "+447000000007" "Chloe" "Can you help me with a cake?" "demo_t7")

check_field "$RESP" "intent"             "unknown"
check_field "$RESP" "conversation_state" "awaiting_clarification"

CHECKOUT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checkout_url','null'))")
if [ "$CHECKOUT" = "null" ] || [ "$CHECKOUT" = "None" ]; then
  pass "no order created for ambiguous message (correct)"
else
  fail "ambiguous message should not create an order"
fi

info "$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply_text'][:140])")"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "$SEP"
echo -e "${GREEN}All 7 test cases complete.${NC}"
echo ""
echo "Full response example (test 1):"
post_msg "+447000000099" "Demo" "I want a chocolate birthday cake for Saturday pickup." "demo_full" | python3 -m json.tool 2>/dev/null | head -40
echo ""
