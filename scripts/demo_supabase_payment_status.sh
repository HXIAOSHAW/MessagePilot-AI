#!/usr/bin/env bash
# scripts/demo_supabase_payment_status.sh
#
# Simulates a PayPal payment webhook for an existing order, then (when
# DATA_MODE=supabase) queries Supabase directly to confirm the order status
# was updated.
#
# Usage:
#   bash scripts/demo_supabase_payment_status.sh <order_id>
#
# Example:
#   bash scripts/demo_supabase_payment_status.sh abc-123-def
#
# Or run with Supabase verification:
#   DATA_MODE=supabase SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
#     bash scripts/demo_supabase_payment_status.sh <order_id>

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
ORDER_ID="${1:-}"

if [[ -z "${ORDER_ID}" ]]; then
  echo "Usage: bash scripts/demo_supabase_payment_status.sh <order_id>"
  echo ""
  echo "Tip: first run demo_supabase_order_flow.sh and copy the order_id from the response."
  exit 1
fi

DATA_MODE_VAL="${DATA_MODE:-memory}"

echo "══════════════════════════════════════════════════════════════════"
echo "  MessagePilot AI — Payment Status Demo"
echo "  Order ID:  ${ORDER_ID}"
echo "  DATA_MODE: ${DATA_MODE_VAL}"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# ── POST /payment/status ──────────────────────────────────────────────────────
echo "── Sending payment webhook ───────────────────────────────────────"
echo "   POST /payment/status  { order_id: \"${ORDER_ID}\", payment_status: \"paid\" }"
echo ""

curl -s -o /tmp/mp_payment_response.json -w "" \
  -X POST "${BASE_URL}/payment/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"${ORDER_ID}\",
    \"payment_status\": \"paid\",
    \"provider_reference\": \"PAYPAL-DEMO-$(date +%s)\"
  }"

echo "── Response ──────────────────────────────────────────────────────"
python3 -m json.tool /tmp/mp_payment_response.json 2>/dev/null || cat /tmp/mp_payment_response.json
echo ""

python3 - <<PYEOF
import json, sys

with open("/tmp/mp_payment_response.json") as f:
    r = json.load(f)

ok = r.get("success") is True or r.get("status") in ("ok", "updated", "paid")
if ok:
    print("  ✓ Backend confirmed payment status update")
else:
    print("  ✗ Backend response did not confirm update:", r)
    sys.exit(1)
PYEOF

# ── Supabase verification (only when DATA_MODE=supabase) ──────────────────────
if [[ "${DATA_MODE_VAL}" == "supabase" ]]; then
  if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "── Supabase verification ──────────────────────────────────────────"
    echo "   ⚠  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase check."
  else
    echo "── Verifying order status in Supabase ────────────────────────────"
    HTTP_STATUS=$(curl -s -o /tmp/mp_sb_order.json -w "%{http_code}" \
      "${SUPABASE_URL}/rest/v1/orders?id=eq.${ORDER_ID}&select=id,status" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Accept: application/json")

    if [[ "${HTTP_STATUS}" != "200" ]]; then
      echo "   ❌  Supabase returned HTTP ${HTTP_STATUS}"
      cat /tmp/mp_sb_order.json
      exit 1
    fi

    python3 - <<PYEOF2
import json, sys

with open("/tmp/mp_sb_order.json") as f:
    rows = json.load(f)

if not rows:
    print("  ✗ Order ${ORDER_ID} not found in Supabase orders table")
    sys.exit(1)

order = rows[0]
status = order.get("status")
print(f"  Order {order.get('id')} → status: {status}")

if status == "paid":
    print("  ✓ Supabase order status confirmed: paid")
else:
    print(f"  ⚠  Order status is '{status}' (expected 'paid')")
PYEOF2
  fi
fi

echo ""
echo "✅  Payment status demo complete."
