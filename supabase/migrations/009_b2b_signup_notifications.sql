-- ============================================
-- 009: B2B Signup with Approval + Admin Notifications
-- ============================================

-- Add B2B fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_idx ON customers (email) WHERE email IS NOT NULL;

-- Admin notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('signup_request', 'order', 'stock_alert', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_notifications_read_idx ON admin_notifications (is_read, created_at DESC);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Service role full access on admin_notifications') THEN
    CREATE POLICY "Service role full access on admin_notifications" ON admin_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Authenticated can read admin_notifications') THEN
    CREATE POLICY "Authenticated can read admin_notifications" ON admin_notifications FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_notifications' AND policyname='Authenticated can update admin_notifications') THEN
    CREATE POLICY "Authenticated can update admin_notifications" ON admin_notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Update existing customers to approved (they were already verified)
UPDATE customers SET approval_status = 'approved' WHERE is_verified = TRUE AND approval_status = 'pending';
