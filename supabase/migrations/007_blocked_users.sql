-- ── 007: Blocked Users Table ───────────────────────────────
-- Admins can block users by email and/or phone number.
-- Blocked users cannot log in or sign up.

CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  email TEXT,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At least one identifier must be present
ALTER TABLE blocked_users ADD CONSTRAINT blocked_users_has_identifier
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
