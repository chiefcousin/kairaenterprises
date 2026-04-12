-- ============================================
-- Stock Movements — audit trail for every inventory change
-- ============================================

CREATE TABLE stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'purchase',      -- stock received / purchased
    'sale',          -- sold (from confirmed order)
    'adjustment',    -- manual correction (e.g. count mismatch)
    'return',        -- customer return
    'damage',        -- damaged / written off
    'sync_zoho',     -- auto-updated from Zoho sync
    'sync_local',    -- pushed to Zoho from local change
    'initial'        -- initial stock entry
  )),
  quantity_change INT NOT NULL,           -- positive = stock in, negative = stock out
  quantity_before INT NOT NULL,           -- snapshot before this movement
  quantity_after INT NOT NULL,            -- snapshot after this movement
  reference TEXT,                         -- order ID, Zoho item ID, or other reference
  notes TEXT,                             -- human-readable notes
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- null for system/sync actions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_product_created ON stock_movements(product_id, created_at DESC);

-- Add cost_price to products for inventory valuation
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;

-- Add low_stock_threshold per product (default 5)
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5;

-- RLS: authenticated users can read, admin/partner can insert
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stock movements"
  ON stock_movements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Function to get inventory summary stats
CREATE OR REPLACE FUNCTION get_inventory_summary()
RETURNS TABLE(
  total_products BIGINT,
  total_stock_value DECIMAL,
  total_cost_value DECIMAL,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  total_units BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_products,
    COALESCE(SUM(p.price * p.stock_quantity), 0)::DECIMAL AS total_stock_value,
    COALESCE(SUM(p.cost_price * p.stock_quantity), 0)::DECIMAL AS total_cost_value,
    COUNT(*) FILTER (WHERE p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold)::BIGINT AS low_stock_count,
    COUNT(*) FILTER (WHERE p.stock_quantity = 0)::BIGINT AS out_of_stock_count,
    COALESCE(SUM(p.stock_quantity), 0)::BIGINT AS total_units
  FROM products p
  WHERE p.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent stock movements with product name
CREATE OR REPLACE FUNCTION get_recent_stock_movements(result_limit INT DEFAULT 50, product_filter UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  movement_type TEXT,
  quantity_change INT,
  quantity_before INT,
  quantity_after INT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    sm.movement_type,
    sm.quantity_change,
    sm.quantity_before,
    sm.quantity_after,
    sm.reference,
    sm.notes,
    sm.created_at
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
  WHERE (product_filter IS NULL OR sm.product_id = product_filter)
  ORDER BY sm.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
