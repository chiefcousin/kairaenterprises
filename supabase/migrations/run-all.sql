-- ============================================================
-- Kaira Enterprises — Run All Migrations
-- Paste this entire file into the Supabase SQL Editor and click Run
-- ============================================================

-- ── 002: Customers Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL UNIQUE,
  address TEXT,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_is_verified_idx ON customers (is_verified);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Service role full access on customers') THEN
    CREATE POLICY "Service role full access on customers" ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Public can insert customers') THEN
    CREATE POLICY "Public can insert customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Public can select own customer by phone') THEN
    CREATE POLICY "Public can select own customer by phone" ON customers FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $fn$;

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_customers_updated_at();

-- ── 003: User Roles Table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','partner','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Service role full access on user_roles') THEN
    CREATE POLICY "Service role full access on user_roles" ON user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Users can read their own role') THEN
    CREATE POLICY "Users can read their own role" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 004: Product Video Column ────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ── 005: Analytics Functions ─────────────────────────────────
DROP FUNCTION IF EXISTS get_product_sales_analytics(INT);

CREATE OR REPLACE FUNCTION get_product_sales_analytics(days_back INT DEFAULT 30)
RETURNS TABLE(product_id UUID, product_name TEXT, views BIGINT, clicks BIGINT, fulfilled BIGINT, revenue NUMERIC)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id, p.name,
    COUNT(DISTINCT pv.id) AS views,
    COUNT(DISTINCT wo.id) FILTER (WHERE wo.status != 'cancelled') AS clicks,
    COUNT(DISTINCT wo.id) FILTER (WHERE wo.status = 'fulfilled') AS fulfilled,
    COALESCE(SUM(wo.price * wo.quantity) FILTER (WHERE wo.status = 'fulfilled'), 0) AS revenue
  FROM products p
  LEFT JOIN product_views pv ON pv.product_id = p.id
    AND pv.viewed_at >= NOW() - (days_back || ' days')::INTERVAL
  LEFT JOIN whatsapp_orders wo ON wo.product_id = p.id
    AND wo.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY p.id, p.name
  ORDER BY fulfilled DESC, clicks DESC, views DESC
$$;

GRANT EXECUTE ON FUNCTION get_product_sales_analytics(INT) TO authenticated, service_role;

DROP FUNCTION IF EXISTS get_returning_customers_count();

CREATE OR REPLACE FUNCTION get_returning_customers_count()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*) FROM (
    SELECT customer_phone FROM whatsapp_orders
    WHERE customer_phone IS NOT NULL
    GROUP BY customer_phone HAVING COUNT(*) > 1
  ) AS t
$$;

GRANT EXECUTE ON FUNCTION get_returning_customers_count() TO authenticated, service_role;

-- ── 007: Blocked Users Table ───────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  email TEXT,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blocked_users ADD CONSTRAINT IF NOT EXISTS blocked_users_has_identifier
  CHECK (phone IS NOT NULL OR email IS NOT NULL);

CREATE INDEX IF NOT EXISTS blocked_users_phone_idx ON blocked_users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS blocked_users_email_idx ON blocked_users (email) WHERE email IS NOT NULL;

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='Service role full access on blocked_users') THEN
    CREATE POLICY "Service role full access on blocked_users" ON blocked_users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='Authenticated can read blocked_users') THEN
    CREATE POLICY "Authenticated can read blocked_users" ON blocked_users FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── Done ─────────────────────────────────────────────────────
SELECT 'All migrations applied successfully ✓' AS status;
