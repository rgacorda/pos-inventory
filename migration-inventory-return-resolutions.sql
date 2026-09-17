-- =============================================================================
-- Migration: Inventory return fulfill / credit columns
--
-- Background: Returns can now be closed from a later delivery by either
--             fulfilling replacements (including different products) or
--             crediting the returned cost against that invoice. These
--             columns store how a return was resolved and which delivery
--             applied it.
--
-- Adds:
--   inventory_returns.resolutionType
--   inventory_returns.resolvedDeliveryId
--   inventory_deliveries.returnCreditAmount
--   inventory_deliveries.returnResolutions
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-inventory-return-resolutions.sql
--
-- Safe to re-run: ADD COLUMN / CREATE INDEX use IF NOT EXISTS.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. How a return was closed (REPLACEMENT, FULFILL, or CREDIT).
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_returns
  ADD COLUMN IF NOT EXISTS "resolutionType" varchar(50) NULL;

-- ---------------------------------------------------------------------------
-- 2. Delivery that fulfilled or credited the return, when resolution
--    happened from a delivery instead of the Returns tab.
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_returns
  ADD COLUMN IF NOT EXISTS "resolvedDeliveryId" uuid NULL;

CREATE INDEX IF NOT EXISTS "IDX_inventory_returns_resolvedDeliveryId"
  ON inventory_returns ("resolvedDeliveryId");

-- ---------------------------------------------------------------------------
-- 3. Amount credited against a delivery invoice from supplier returns
--    that were closed without a product replacement.
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_deliveries
  ADD COLUMN IF NOT EXISTS "returnCreditAmount" decimal(10, 2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 4. Returns the user chose to fulfill or credit on this delivery.
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_deliveries
  ADD COLUMN IF NOT EXISTS "returnResolutions" jsonb NULL;

-- ---------------------------------------------------------------------------
-- 5. Existing resolved returns were only closable by recording
--    replacement items, so backfill them as REPLACEMENT.
-- ---------------------------------------------------------------------------
UPDATE inventory_returns
SET "resolutionType" = 'REPLACEMENT'
WHERE status = 'RESOLVED'
  AND "resolutionType" IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Verify: show a summary of the new schema
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  resolution_type_exists BOOLEAN;
  resolved_delivery_exists BOOLEAN;
  credit_amount_exists BOOLEAN;
  resolutions_exists BOOLEAN;
  backfilled_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_returns' AND column_name = 'resolutionType'
  ) INTO resolution_type_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_returns' AND column_name = 'resolvedDeliveryId'
  ) INTO resolved_delivery_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_deliveries' AND column_name = 'returnCreditAmount'
  ) INTO credit_amount_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_deliveries' AND column_name = 'returnResolutions'
  ) INTO resolutions_exists;

  SELECT COUNT(*) INTO backfilled_count
    FROM inventory_returns
    WHERE status = 'RESOLVED' AND "resolutionType" = 'REPLACEMENT';

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'Inventory return resolution migration complete.';
  RAISE NOTICE '  resolutionType column     : %', resolution_type_exists;
  RAISE NOTICE '  resolvedDeliveryId column : %', resolved_delivery_exists;
  RAISE NOTICE '  returnCreditAmount column : %', credit_amount_exists;
  RAISE NOTICE '  returnResolutions column  : %', resolutions_exists;
  RAISE NOTICE '  Resolved returns backfilled as REPLACEMENT: %', backfilled_count;
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Unresolved returns are unchanged (resolutionType stays NULL).
--   • Previously resolved returns are tagged REPLACEMENT.
--   • Existing deliveries get returnCreditAmount = 0 and no resolutions.
-- =============================================================================
