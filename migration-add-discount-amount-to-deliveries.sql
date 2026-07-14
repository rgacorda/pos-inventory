-- =============================================================================
-- Migration: Add discountAmount to inventory_deliveries
--
-- Background: Suppliers sometimes give a flat discount on a delivery/invoice
--             (e.g. a promo or loyalty discount). Previously there was no way
--             to record this - the "supplier gave X, buyer paid Y" difference
--             just wasn't tracked anywhere. This adds a `discountAmount`
--             column so the app can record the discount and automatically
--             subtract it from the items subtotal to get the final
--             `totalCost` actually paid to the supplier.
--
--             Existing rows default to 0 (no discount), so historical totals
--             are unaffected.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-add-discount-amount-to-deliveries.sql
--
-- Safe to re-run: all statements use IF NOT EXISTS / idempotent guards.
-- =============================================================================

BEGIN;

ALTER TABLE inventory_deliveries
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Verify: report column presence.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_deliveries' AND column_name = 'discountAmount'
  ) THEN
    RAISE EXCEPTION 'Migration verification FAILED. inventory_deliveries."discountAmount" is missing.';
  END IF;

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'discountAmount column added to inventory_deliveries (default 0).';
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • All existing deliveries default to discountAmount = 0, so their
--     totalCost is unchanged.
--   • Going forward, the app subtracts discountAmount from the items
--     subtotal to compute totalCost, so totalCost always reflects what was
--     actually paid to the supplier.
-- =============================================================================
