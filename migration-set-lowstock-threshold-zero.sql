-- =============================================================================
-- Migration: Set all product lowStockThreshold values to 0
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-set-lowstock-threshold-zero.sql
--
-- Safe to re-run: idempotent (sets every row to 0).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Set lowStockThreshold to 0 for all products (including NULL values)
-- ---------------------------------------------------------------------------
UPDATE products
SET "lowStockThreshold" = 0;

-- ---------------------------------------------------------------------------
-- 2. Verify: all products should have lowStockThreshold = 0
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  non_zero_count INT;
  total_count    INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM products;

  SELECT COUNT(*) INTO non_zero_count
  FROM products
  WHERE "lowStockThreshold" IS DISTINCT FROM 0;

  IF non_zero_count > 0 THEN
    RAISE EXCEPTION 'Migration verification FAILED. % of % products still have lowStockThreshold != 0',
      non_zero_count, total_count;
  ELSE
    RAISE NOTICE 'Migration verification PASSED. All % products have lowStockThreshold = 0.', total_count;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Low stock alerts will only trigger when stockQuantity <= 0.
--   • Run a sync on the POS and inventory apps after applying this migration.
-- =============================================================================
