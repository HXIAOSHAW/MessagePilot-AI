#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Demo: Order Flow
# Tests the full order flow with Luna Bakery demo data.
# Usage: bash scripts/demo_order_flow.sh [BASE_URL]
# ──────────────────────────────────────────────────────────────────────────────

BASE_URL="${1:-http://localhost:3001}"
SEPARATOR="────────────────────────────────────────────────────────"

echo ""
echo "🎂 OrderPilot AI — Order Flow Demo"
echo "$SEPARATOR"

# ── Step 1: Health check ──────────────────────────────────────────────────────

echo ""
echo "① Health check"
curl -s "$BASE_URL/health" | jq '.status, .storage, .adapters'

# ── Step 2: Simple order with date ───────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "② Order: Chocolate birthday cake for Friday pickup"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000001",
    "customer_name": "Sarah",
    "message": "I want to order a chocolate birthday cake for Friday pickup",
    "image_url": null,
    "conversation_id": "wa_conv_demo_001"
  }' | jq '{intent: .intent, reply: .reply, checkout_url: .checkout_url, order_id: .order.id, total: .order.total_gbp}'

# ── Step 3: Incomplete order (no date) ───────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "③ Incomplete order (missing date — should ask for more info)"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000002",
    "customer_name": "Tom",
    "message": "I want to order a chocolate cake",
    "image_url": null,
    "conversation_id": "wa_conv_demo_002"
  }' | jq '{intent: .intent, reply: .reply}'

# ── Step 4: Cupcake order ─────────────────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "④ Cupcake box order for Saturday"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000003",
    "customer_name": "Priya",
    "message": "Can I get a cupcake box for Saturday? Its for my mums birthday",
    "image_url": null,
    "conversation_id": "wa_conv_demo_003"
  }' | jq '{intent: .intent, reply: .reply, checkout_url: .checkout_url}'

# ── Step 5: Dashboard ─────────────────────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "⑤ Dashboard summary after orders"
curl -s "$BASE_URL/dashboard/summary?business_id=demo_luna_bakery" | jq '{orders_drafted: .orders_drafted, top_products: .top_products}'

echo ""
echo "$SEPARATOR"
echo "✅ Order flow demo complete!"
echo ""
