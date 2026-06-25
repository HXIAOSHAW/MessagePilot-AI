---
name: Dataset task
about: Add or improve test messages, catalog entries, or business profiles
labels: dataset
---

## What needs adding or improving?

<!-- Describe what's missing or wrong in the dataset. -->

## File(s)

- [ ] `datasets/demo_businesses/`
- [ ] `datasets/catalog/`
- [ ] `datasets/test_messages/order_messages.json`
- [ ] `datasets/test_messages/complaint_messages.json`
- [ ] `datasets/test_messages/mixed_messages.json`

## Example message(s) to add

```json
{
  "id": "om_XXX",
  "description": "...",
  "business_id": "demo_luna_bakery",
  "customer_phone": "+447000000000",
  "customer_name": "...",
  "message": "...",
  "image_url": null,
  "conversation_id": "wa_conv_XXX",
  "expected_intent": "order | complaint | product_question | human_handover | unknown",
  "expected_severity": "low | medium | high"
}
```

## Branch

`feature/dataset-demo-cases`
