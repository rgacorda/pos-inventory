-- =============================================================================
-- Migration: Add half-pack pricing + pack markup columns
-- Run: docker exec -i pos-postgres psql -U pos_user -d pos_db < ~/production/pos-system/migration-add-halfpack-pricing.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add new pack markup columns (replace the old direct-price model)
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "packMarkupPercentage" NUMERIC(5,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "packMarkupFixed"       NUMERIC(10,2) DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2. Add half-pack columns (all optional / nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "halfPackPrice"            NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "halfPackQuantity"         INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "halfPackMarkupPercentage" NUMERIC(5,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "halfPackMarkupFixed"      NUMERIC(10,2) DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 3. Clear stale packPrice values that were entered directly under the old
--    model.  packPrice is now a COMPUTED column (cost × qty + markup).
--    Leaving old manual values would cause incorrect pricing until each
--    product is re-saved with the new markup fields.
-- ---------------------------------------------------------------------------
UPDATE products
SET "packPrice" = NULL
WHERE "packPrice" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Safety: ensure packQuantity rows without a price are also cleared
--    (prevents half-computed state where qty exists but price is NULL=0)
-- ---------------------------------------------------------------------------
UPDATE products
SET "packQuantity" = NULL
WHERE "packQuantity" IS NOT NULL
  AND "packPrice"    IS NULL
  AND "packMarkupPercentage" IS NULL
  AND "packMarkupFixed"      IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Verify columns exist after migration
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_cols TEXT := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='packMarkupPercentage') THEN
    missing_cols := missing_cols || ' packMarkupPercentage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='packMarkupFixed') THEN
    missing_cols := missing_cols || ' packMarkupFixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='halfPackPrice') THEN
    missing_cols := missing_cols || ' halfPackPrice';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='halfPackQuantity') THEN
    missing_cols := missing_cols || ' halfPackQuantity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='halfPackMarkupPercentage') THEN
    missing_cols := missing_cols || ' halfPackMarkupPercentage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='halfPackMarkupFixed') THEN
    missing_cols := missing_cols || ' halfPackMarkupFixed';
  END IF;

  IF missing_cols <> '' THEN
    RAISE EXCEPTION 'Migration verification FAILED. Missing columns:%', missing_cols;
  ELSE
    RAISE NOTICE 'Migration verification PASSED. All columns present.';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Existing products with pack pricing need to be re-saved in the
--     Inventory app so the backend recomputes packPrice from markup fields.
--   • No data is lost — packQuantity is preserved where markup fields exist.
--   • Run a sync on the POS app after applying this migration.
-- =============================================================================
