# OrderPilot AI — API Contract

Base URL: `http://localhost:3001`

---

## GET /health

Returns the server status and adapter configuration.

### Response

```json
{
  "status": "ok",
  "service": "OrderPilot AI Backend",
  "version": "0.1.0",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "storage": "in-memory (mock)",
  "adapters": {
    "messaging": "mock",
    "payment": "mock",
    "manus": "mock"
  }
}
```

---

## POST /agent/message

Accepts an inbound WhatsApp message and routes it to the appropriate agent.

### Request body

```json
{
  "business_id": "demo_luna_bakery",
  "customer_phone": "+447000000000",
  "customer_name": "Sarah",
  "message": "I want to order a chocolate birthday cake for Friday pickup",
  "image_url": null,
  "conversation_id": "wa_conv_123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `business_id` | string | ✓ | Identifies which business this message belongs to |
| `customer_phone` | string | ✓ | Customer's WhatsApp phone number |
| `customer_name` | string | ✓ | Customer's display name |
| `message` | string | ✓ | The message text |
| `image_url` | string \| null | ✓ | Attached image URL (null if none) |
| `conversation_id` | string | ✓ | WhatsApp conversation thread ID |

### Response (order)

```json
{
  "success": true,
  "intent": "order",
  "reply": "Hi Sarah! Here's your order summary:\n\n• 1x Chocolate Birthday Cake — £29.00\n🏪 Pickup: Friday\n💰 Total: £29.00\n\nTo confirm and pay, tap the link below:\nhttps://demo.orderpilot.ai/pay/...\n\nYour order will be confirmed once payment is received. 🎉",
  "order": {
    "id": "uuid",
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447000000000",
    "customer_name": "Sarah",
    "items": [
      {
        "product_id": "prod_choc_birthday_cake",
        "product_name": "Chocolate Birthday Cake",
        "quantity": 1,
        "unit_price_gbp": 29.00,
        "subtotal_gbp": 29.00
      }
    ],
    "fulfillment": "pickup",
    "requested_date": "Friday",
    "notes": "",
    "total_gbp": 29.00,
    "status": "pending_payment",
    "checkout_url": "https://demo.orderpilot.ai/pay/...",
    "created_at": "2026-06-25T12:00:00.000Z"
  },
  "complaint": null,
  "owner_task": null,
  "checkout_url": "https://demo.orderpilot.ai/pay/...",
  "routing": {
    "intent": "order",
    "confidence": 0.8
  },
  "duration_ms": 12
}
```

### Response (complaint)

```json
{
  "success": true,
  "intent": "complaint",
  "reply": "Our team has received your message and a member of staff will be in touch shortly...",
  "order": null,
  "complaint": {
    "id": "uuid",
    "business_id": "demo_luna_bakery",
    "customer_phone": "+447111111111",
    "customer_name": "James",
    "issue_summary": "Customer is furious, demanding full refund...",
    "order_reference": null,
    "urgency": "high",
    "evidence": [],
    "desired_outcome": "full refund",
    "severity": "high",
    "safe_reply": "Our team has received your message...",
    "requires_escalation": true,
    "created_at": "2026-06-25T12:00:00.000Z"
  },
  "owner_task": {
    "id": "uuid",
    "business_id": "demo_luna_bakery",
    "type": "complaint_escalation",
    "title": "[HIGH] Complaint from James",
    "description": "...",
    "priority": "urgent",
    "related_order_id": null,
    "related_complaint_id": "uuid",
    "status": "open",
    "created_at": "2026-06-25T12:00:00.000Z"
  },
  "checkout_url": null,
  "routing": { "intent": "complaint", "confidence": 0.75 },
  "duration_ms": 28
}
```

### Error responses

```json
{ "error": "Invalid request", "details": { "fieldErrors": { "business_id": ["Required"] } } }
```

---

## POST /payment/status

Webhook endpoint for payment provider callbacks.

### Request body

```json
{
  "order_id": "uuid",
  "payment_provider_ref": "PAYPAL-ABC123",
  "status": "completed",
  "amount_gbp": 29.00,
  "business_id": "demo_luna_bakery"
}
```

| `status` values | Meaning |
|---|---|
| `completed` | Payment successful → order moves to `confirmed` |
| `failed` | Payment failed → order stays in current status |
| `pending` | Payment pending → no status change |
| `refunded` | Refund issued → order moves to `cancelled` |

### Response

```json
{
  "success": true,
  "order_id": "uuid",
  "new_status": "confirmed",
  "processed_at": "2026-06-25T12:00:00.000Z"
}
```

---

## GET /dashboard/summary

Returns an operations summary for the owner dashboard.

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `business_id` | ✓ | The business to summarise |

### Response

```json
{
  "business_id": "demo_luna_bakery",
  "period": "all_time",
  "total_messages": 5,
  "orders_drafted": 3,
  "complaints_received": 2,
  "owner_tasks_open": 1,
  "top_products": [
    { "name": "Chocolate Birthday Cake", "count": 2 },
    { "name": "Cupcake Box", "count": 1 }
  ],
  "open_tasks": [
    {
      "id": "uuid",
      "type": "complaint_escalation",
      "title": "[HIGH] Complaint from James",
      "priority": "urgent",
      "status": "open",
      "created_at": "2026-06-25T12:00:00.000Z"
    }
  ],
  "generated_at": "2026-06-25T12:00:00.000Z"
}
```
