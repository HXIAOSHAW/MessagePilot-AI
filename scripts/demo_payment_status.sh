#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Demo: Payment Status Webhook
# Simulates a payment provider webhook after a checkout is completed.
# Usage: bash scripts/demo_payment_status.sh [ORDER_ID] [BASE_URL]
# ──────────────────────────────────────────────────────────────────────────────

ORDER_ID="${1:-}"
BASE_URL="${2:-http://localhost:3001}"

if [ -z "$ORDER_ID" ]; then
  echo "Usage: bash scripts/demo_payment_status.sh <ORDER_ID> [BASE_URL]"
  echo ""
  echo "Tip: Run demo_order_flow.sh first and copy an order ID from the output."
  exit 1
fi

echo ""
echo "💳 OrderPilot AI — Payment Status Demo"
echo "Order ID: $ORDER_ID"
echo ""

echo "① Simulating payment completion webhook..."
curl -s -X POST "$BASE_URL/payment/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"payment_provider_ref\": \"MOCK-$(uuidgen | cut -c1-8 | tr '[:lower:]' '[:upper:]')\",
    \"status\": \"completed\",
    \"amount_gbp\": 29.00,
    \"business_id\": \"demo_luna_bakery\"
  }" | jq

echo ""
echo "② Dashboard after payment..."
curl -s "$BASE_URL/dashboard/summary?business_id=demo_luna_bakery" | jq '{orders_drafted: .orders_drafted}'
echo ""
echo "✅ Payment status demo complete!"
echo ""
