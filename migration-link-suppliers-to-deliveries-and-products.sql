-- =============================================================================
-- Migration: Link suppliers table to inventory_deliveries and products
--
-- Background: The "supplier" field on inventory_deliveries has always been
--             manual free-text. This migration adds a proper `supplierId`
--             foreign key (nullable) to `inventory_deliveries` so new
--             deliveries can reference the `suppliers` table instead of
--             free-typed text. It also adds a `supplierId` foreign key to
--             `products`, which the app now sets automatically whenever a
--             RECEIVED delivery (linked to a supplier) includes that
--             product, so products can be filtered by supplier later on.
--
--             Existing (legacy) deliveries keep their free-text `supplier`
--             value untouched — `supplierId` is nullable and NOT backfilled
--             with guesses, since fuzzy-matching old text to suppliers could
--             silently link the wrong supplier. Only new/edited deliveries
--             (via the app) populate `supplierId` going forward.
--
--             A best-effort, exact-match (case-insensitive, trimmed) backfill
--             is included as an optional, clearly-separated step below for
--             deliveries whose free-text `supplier` name exactly matches an
--             existing supplier's name in the same organization. This is
--             safe and conservative: it only links unambiguous exact matches
--             and never overwrites or deletes the original text.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-link-suppliers-to-deliveries-and-products.sql
--
-- Safe to re-run: all statements use IF NOT EXISTS / idempotent guards.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add supplierId to inventory_deliveries (nullable — legacy rows keep
--    their free-text supplier and simply have supplierId = NULL).
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_deliveries
  ADD COLUMN IF NOT EXISTS "supplierId" UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS "IDX_inventory_deliveries_supplierId"
  ON inventory_deliveries ("supplierId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_inventory_deliveries_supplierId'
  ) THEN
    ALTER TABLE inventory_deliveries
      ADD CONSTRAINT "FK_inventory_deliveries_supplierId"
      FOREIGN KEY ("supplierId") REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Add supplierId to products (nullable — existing products predate this
--    field and simply have supplierId = NULL until their next delivery).
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "supplierId" UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS "IDX_products_supplierId"
  ON products ("supplierId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_products_supplierId'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT "FK_products_supplierId"
      FOREIGN KEY ("supplierId") REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. OPTIONAL best-effort backfill: link legacy deliveries to an existing
--    supplier ONLY when the free-text `supplier` name is an exact,
--    case-insensitive/trimmed match to a supplier already registered in the
--    same organization. Ambiguous matches (more than one supplier with the
--    same name in the org) are skipped on purpose. Deliveries that already
--    have a supplierId are left untouched. The original `supplier` text
--    column is never modified by this step.
-- ---------------------------------------------------------------------------
WITH candidate_matches AS (
  SELECT
    d.id AS delivery_id,
    s.id AS supplier_id
  FROM inventory_deliveries d
  JOIN suppliers s
    ON s."organizationId" = d."organizationId"
   AND LOWER(TRIM(s.name)) = LOWER(TRIM(d.supplier))
  WHERE d."supplierId" IS NULL
),
unambiguous_matches AS (
  SELECT delivery_id, MIN(supplier_id) AS supplier_id
  FROM candidate_matches
  GROUP BY delivery_id
  HAVING COUNT(*) = 1
)
UPDATE inventory_deliveries d
SET "supplierId" = m.supplier_id
FROM unambiguous_matches m
WHERE d.id = m.delivery_id;

-- ---------------------------------------------------------------------------
-- 4. Verify: report column/constraint presence and backfill coverage.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  deliveries_linked   INT;
  deliveries_total    INT;
  products_linked     INT;
  products_total      INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_deliveries' AND column_name = 'supplierId') THEN
    RAISE EXCEPTION 'Migration verification FAILED. inventory_deliveries."supplierId" is missing.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'supplierId') THEN
    RAISE EXCEPTION 'Migration verification FAILED. products."supplierId" is missing.';
  END IF;

  SELECT COUNT(*) INTO deliveries_total FROM inventory_deliveries;
  SELECT COUNT(*) INTO deliveries_linked FROM inventory_deliveries WHERE "supplierId" IS NOT NULL;
  SELECT COUNT(*) INTO products_total FROM products;
  SELECT COUNT(*) INTO products_linked FROM products WHERE "supplierId" IS NOT NULL;

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'Supplier linking migration complete.';
  RAISE NOTICE '  inventory_deliveries with supplierId: % / %', deliveries_linked, deliveries_total;
  RAISE NOTICE '  products with supplierId            : % / %', products_linked, products_total;
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Legacy deliveries keep their original free-text `supplier` value.
--     Only exact-name matches were auto-linked to a supplierId (step 3);
--     everything else remains unlinked until edited in the app.
--   • New/edited deliveries created via the app now require picking a
--     supplier from the `suppliers` table; the app auto-syncs the legacy
--     `supplier` text column from the chosen supplier's name.
--   • Whenever a RECEIVED delivery with a linked supplier includes a
--     product, that product's `supplierId` is stamped automatically —
--     existing products remain unlinked (NULL) until their next delivery.
--   • No existing data was deleted or overwritten by this migration.
-- =============================================================================
