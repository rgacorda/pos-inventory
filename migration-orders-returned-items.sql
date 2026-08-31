-- =============================================================================
-- Migration: Add returnedItems column to orders
--
-- Background: Exchange transactions restore inventory for products that were
--             returned, but the server never persisted which products/qty
--             came back. Inventory and POS need this list to show what was
--             exchanged. This column stores that payload as JSONB.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-orders-returned-items.sql
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Store products returned as part of an exchange (name, sku, quantity,
--    unit price). Written on the original order by POST /orders/:id/exchange
--    and on both original + exchange orders during POS sync fallback.
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "returnedItems" jsonb;

-- ---------------------------------------------------------------------------
-- 2. Verify: confirm the column exists
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
      AND column_name = 'returnedItems'
  ) INTO col_exists;

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'orders.returnedItems migration complete.';
  RAISE NOTICE '  Column exists: %', col_exists;
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Existing rows stay NULL until a new exchange is processed.
--   • Historical exchanges are not backfilled (returned item data was never
--     stored on the server).
--   • Restart the backend API after applying this if it is already running.
-- =============================================================================
