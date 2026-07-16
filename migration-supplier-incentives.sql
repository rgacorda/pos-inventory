-- =============================================================================
-- Migration: Add supplier incentives tracking
--
-- Background: Suppliers can receive incentive payments (money given). This
--             migration adds aggregate fields on suppliers and a ledger table
--             for per-payment history.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-supplier-incentives.sql
--
--   # or via docker compose:
--   docker compose exec -T postgres psql -U pos_user -d pos_db \
--     < migration-supplier-incentives.sql
--
-- Safe to re-run: uses IF NOT EXISTS / conditional constraint creation.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add aggregate incentive fields to suppliers
-- ---------------------------------------------------------------------------
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS "totalIncentiveGiven" numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS "lastIncentiveDate" timestamp NULL;

-- ---------------------------------------------------------------------------
-- 2. Create supplier_incentives ledger table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_incentives (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId"  uuid         NOT NULL,
  "supplierId"      uuid         NOT NULL,
  amount            numeric(10, 2) NOT NULL,
  "incentiveDate"   timestamp    NOT NULL,
  notes             text         NULL,
  "createdAt"       timestamp    NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes for common lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IDX_supplier_incentives_organizationId"
  ON supplier_incentives ("organizationId");

CREATE INDEX IF NOT EXISTS "IDX_supplier_incentives_supplierId"
  ON supplier_incentives ("supplierId");

CREATE INDEX IF NOT EXISTS "IDX_supplier_incentives_incentiveDate"
  ON supplier_incentives ("incentiveDate");

-- ---------------------------------------------------------------------------
-- 4. Foreign key: incentive rows are deleted when a supplier is deleted
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FK_supplier_incentives_supplier'
  ) THEN
    ALTER TABLE supplier_incentives
      ADD CONSTRAINT "FK_supplier_incentives_supplier"
      FOREIGN KEY ("supplierId") REFERENCES suppliers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verify: show a summary of affected objects
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  supplier_count        INT;
  incentive_table_exists BOOLEAN;
  supplier_with_totals  INT;
BEGIN
  SELECT COUNT(*) INTO supplier_count FROM suppliers;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'supplier_incentives'
  ) INTO incentive_table_exists;

  SELECT COUNT(*) INTO supplier_with_totals
    FROM suppliers
   WHERE "totalIncentiveGiven" IS NOT NULL;

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'Supplier incentives migration complete.';
  RAISE NOTICE '  Suppliers table rows            : %', supplier_count;
  RAISE NOTICE '  supplier_incentives table exists: %', incentive_table_exists;
  RAISE NOTICE '  Suppliers with totalIncentiveGiven set: %', supplier_with_totals;
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Existing suppliers start with totalIncentiveGiven = 0 and no last date.
--   • Record new incentives via POST /suppliers/:id/incentives in the API.
--   • Restart the backend API after applying this migration in production.
-- =============================================================================
