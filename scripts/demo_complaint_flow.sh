#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Demo: Complaint Flow
# Tests all severity levels and safety rules with Luna Bakery demo data.
# Usage: bash scripts/demo_complaint_flow.sh [BASE_URL]
# ──────────────────────────────────────────────────────────────────────────────

BASE_URL="${1:-http://localhost:3001}"
SEPARATOR="────────────────────────────────────────────────────────"

echo ""
echo "🚨 OrderPilot AI — Complaint Flow Demo"
echo "$SEPARATOR"

# ── Low severity ──────────────────────────────────────────────────────────────

echo ""
echo "① LOW severity: Wrong product received"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111000001",
    "customer_name": "Rachel",
    "message": "Hi, I ordered a chocolate cake but got a vanilla one instead. A bit disappointed as it was for my daughters birthday.",
    "image_url": null,
    "conversation_id": "wa_conv_comp_001"
  }' | jq '{intent: .intent, severity: .complaint.severity, reply: .reply, escalated: .complaint.requires_escalation}'

# ── Medium severity ───────────────────────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "② MEDIUM severity: Damaged product"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111000002",
    "customer_name": "Michael",
    "message": "The cake I picked up was completely squashed. Very upsetting for a special occasion. Id like some kind of resolution.",
    "image_url": null,
    "conversation_id": "wa_conv_comp_002"
  }' | jq '{intent: .intent, severity: .complaint.severity, reply: .reply, escalated: .complaint.requires_escalation}'

# ── High severity — refund demand ─────────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "③ HIGH severity: Angry customer demanding refund (safety rule triggered)"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111000003",
    "customer_name": "James",
    "message": "I am absolutely furious. My cake was completely wrong and I want a full refund immediately. This is unacceptable.",
    "image_url": null,
    "conversation_id": "wa_conv_comp_003"
  }' | jq '{intent: .intent, severity: .complaint.severity, reply: .reply, escalated: .complaint.requires_escalation, owner_task_priority: .owner_task.priority}'

# ── High severity — health and safety ─────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "④ HIGH severity: Allergy / health and safety (immediate escalation)"
curl -s -X POST "$BASE_URL/agent/message" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111000004",
    "customer_name": "Anna",
    "message": "My daughter has a severe nut allergy and ate your cake. We had to take her to hospital. I need to speak to someone urgently.",
    "image_url": null,
    "conversation_id": "wa_conv_comp_004"
  }' | jq '{intent: .intent, severity: .complaint.severity, reply: .reply, escalated: .complaint.requires_escalation, owner_task_title: .owner_task.title}'

# ── Dashboard after complaints ────────────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "⑤ Dashboard summary after complaints"
curl -s "$BASE_URL/dashboard/summary?business_id=demo_luna_bakery" | jq '{complaints_received: .complaints_received, owner_tasks_open: .owner_tasks_open, open_tasks: [.open_tasks[] | {title: .title, priority: .priority}]}'

echo ""
echo "$SEPARATOR"
echo "✅ Complaint flow demo complete!"
echo ""
