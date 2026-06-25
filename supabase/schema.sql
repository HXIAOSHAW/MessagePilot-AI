-- OrderPilot AI — Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.

-- ─── Products ─────────────────────────────────────────────────────────────────
-- Queried by catalogService: GET /rest/v1/products?business_id=eq.<id>&select=*

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_gbp NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT,
  lead_time_hours INTEGER DEFAULT 48,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_business_id_idx ON products(business_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON products FOR ALL USING (auth.role() = 'service_role');

-- ─── Businesses ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'GBP',
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Inbound messages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  conversation_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_business_id_idx ON messages(business_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);

-- ─── Orders ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
  requested_date TEXT,
  notes TEXT DEFAULT '',
  total_gbp NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_payment', 'confirmed', 'fulfilled', 'cancelled')),
  checkout_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_business_id_idx ON orders(business_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

-- ─── Complaints ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  issue_summary TEXT NOT NULL,
  order_reference TEXT,
  urgency TEXT NOT NULL DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high')),
  evidence JSONB NOT NULL DEFAULT '[]',
  desired_outcome TEXT NOT NULL DEFAULT 'resolution',
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  safe_reply TEXT NOT NULL,
  requires_escalation BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS complaints_business_id_idx ON complaints(business_id);
CREATE INDEX IF NOT EXISTS complaints_severity_idx ON complaints(severity);

-- ─── Owner tasks ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS owner_tasks (
  id UUID PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL CHECK (type IN ('order_review', 'complaint_escalation', 'human_handover')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  related_order_id UUID REFERENCES orders(id),
  related_complaint_id UUID REFERENCES complaints(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS owner_tasks_business_id_idx ON owner_tasks(business_id);
CREATE INDEX IF NOT EXISTS owner_tasks_status_idx ON owner_tasks(status);

-- ─── Agent logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  intent TEXT NOT NULL,
  confidence NUMERIC(4, 2),
  agent TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_logs_business_id_idx ON agent_logs(business_id);
CREATE INDEX IF NOT EXISTS agent_logs_created_at_idx ON agent_logs(created_at);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
-- Enable RLS on all tables. Policies below allow the service role full access.

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass (backend uses service role key)
CREATE POLICY "service_role_all" ON businesses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON complaints FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON owner_tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON agent_logs FOR ALL USING (auth.role() = 'service_role');
