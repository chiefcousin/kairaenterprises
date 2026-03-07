-- Migration: 006_product_reviews
-- Adds product reviews and ratings for B2B customers

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One review per customer per product
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_product_customer_idx
  ON product_reviews (product_id, customer_phone);

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON product_reviews (product_id);
CREATE INDEX IF NOT EXISTS product_reviews_rating_idx ON product_reviews (rating);

-- Row Level Security
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on product_reviews"
  ON product_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anyone can read approved reviews
CREATE POLICY "Public can read approved reviews"
  ON product_reviews
  FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);

-- Anyone can insert reviews (customer identified by phone)
CREATE POLICY "Public can insert reviews"
  ON product_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_product_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_product_reviews_updated_at();
