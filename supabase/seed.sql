-- OrderPilot AI — Seed Data
-- Run after schema.sql to populate demo data.

-- ─── Luna Bakery products ─────────────────────────────────────────────────────

INSERT INTO products (id, business_id, name, price_gbp, description, available, category, lead_time_hours)
VALUES
  ('prod_choc_birthday_cake',    'demo_luna_bakery', 'Chocolate Birthday Cake',  29.00, 'Rich dark chocolate sponge with chocolate buttercream and ganache drip. Serves 10-12.',                    TRUE, 'celebration_cakes', 48),
  ('prod_vanilla_birthday_cake', 'demo_luna_bakery', 'Vanilla Birthday Cake',    25.00, 'Classic vanilla sponge with vanilla buttercream and fresh berry topping. Serves 10-12.',                  TRUE, 'celebration_cakes', 48),
  ('prod_cupcake_box',           'demo_luna_bakery', 'Cupcake Box',              18.00, 'Box of 12 assorted cupcakes — mix of chocolate, vanilla and seasonal flavours.',                          TRUE, 'cupcakes',          24),
  ('prod_lemon_drizzle_cake',    'demo_luna_bakery', 'Lemon Drizzle Cake',       22.00, 'Zesty lemon sponge with lemon syrup glaze and candied lemon slices. Serves 8-10.',                        TRUE, 'celebration_cakes', 48),
  ('prod_custom_wedding_tier',   'demo_luna_bakery', 'Custom Wedding Tier',     120.00, 'Two-tier wedding cake, fully customised. Consultation required. Price from £120.',                        TRUE, 'wedding_cakes',    336)
ON CONFLICT (id) DO NOTHING;

-- ─── Demo business: Luna Bakery London ───────────────────────────────────────

INSERT INTO businesses (id, name, owner_name, owner_phone, email, address, currency, timezone, whatsapp_number)
VALUES (
  'demo_luna_bakery',
  'Luna Bakery London',
  'Luna Chen',
  '+447900000001',
  'hello@lunabakery.co.uk',
  '42 Flower Street, Hackney, London E8 3AA',
  'GBP',
  'Europe/London',
  '+447900000002'
) ON CONFLICT (id) DO NOTHING;

-- ─── Sample order ─────────────────────────────────────────────────────────────

INSERT INTO orders (id, business_id, customer_phone, customer_name, items, fulfillment, requested_date, notes, total_gbp, status, checkout_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo_luna_bakery',
  '+447000000001',
  'Sarah',
  '[{"product_id": "prod_choc_birthday_cake", "product_name": "Chocolate Birthday Cake", "quantity": 1, "unit_price_gbp": 29.00, "subtotal_gbp": 29.00}]',
  'pickup',
  'Friday',
  '',
  29.00,
  'pending_payment',
  'https://demo.orderpilot.ai/pay/00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- ─── Sample complaint ─────────────────────────────────────────────────────────

INSERT INTO complaints (id, business_id, customer_phone, customer_name, issue_summary, urgency, desired_outcome, severity, safe_reply, requires_escalation)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'demo_luna_bakery',
  '+447111000001',
  'Rachel',
  'Customer received vanilla cake instead of chocolate cake for daughter birthday.',
  'low',
  'replacement',
  'low',
  'Hi Rachel, thank you for reaching out. We''re very sorry to hear about your experience — this is not the standard we hold ourselves to. Could you share a few more details so we can put things right for you? We''ll do our best to make this right for you.',
  FALSE
) ON CONFLICT (id) DO NOTHING;
