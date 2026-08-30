-- =============================================================================
-- Migration: Create inventory_returns table (Return Items feature)
--
-- Background: Adds support for tracking items returned to suppliers,
--             optionally linked to a specific delivery. Each return starts
--             as NOT_RESOLVED (its returnedItems are deducted from product
--             stock) and can later be marked RESOLVED once the supplier
--             sends replacement items (added back to stock at that point).
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-create-inventory-returns.sql
--
-- Safe to re-run: every statement below is guarded (IF NOT EXISTS / existence
-- checks), so re-running this migration is a no-op once it has been applied.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ensure the uuid-ossp extension is available for uuid_generate_v4().
--    (Already present in this database via other uuid-keyed tables, but
--    guarded here so this migration also works standalone.)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 2. Create the inventory_returns table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_returns (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organizationId"       uuid NOT NULL,
  supplier               varchar NOT NULL,
  "supplierId"           uuid,
  "deliveryId"           uuid,
  reason                 varchar(255),
  notes                  text,
  status                 varchar(50) NOT NULL DEFAULT 'NOT_RESOLVED',
  "returnedItems"        jsonb NOT NULL DEFAULT '[]',
  "replacementItems"     jsonb,
  "returnedTotalCost"    numeric(10, 2) NOT NULL DEFAULT 0,
  "replacementTotalCost" numeric(10, 2),
  "resolvedAt"           timestamp,
  "createdAt"            timestamp NOT NULL DEFAULT now(),
  "updatedAt"            timestamp NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes, mirroring the @Index() columns on the InventoryReturn entity.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IDX_inventory_returns_organizationId"
  ON inventory_returns ("organizationId");

CREATE INDEX IF NOT EXISTS "IDX_inventory_returns_supplierId"
  ON inventory_returns ("supplierId");

CREATE INDEX IF NOT EXISTS "IDX_inventory_returns_deliveryId"
  ON inventory_returns ("deliveryId");

-- ---------------------------------------------------------------------------
-- 4. Foreign keys (SET NULL on delete, matching the entity's onDelete
--    configuration, so removing a supplier/delivery never blocks the delete
--    or silently orphans a return — it just detaches the link).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_inventory_returns_supplierId'
  ) THEN
    ALTER TABLE inventory_returns
      ADD CONSTRAINT "FK_inventory_returns_supplierId"
      FOREIGN KEY ("supplierId") REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_inventory_returns_deliveryId'
  ) THEN
    ALTER TABLE inventory_returns
      ADD CONSTRAINT "FK_inventory_returns_deliveryId"
      FOREIGN KEY ("deliveryId") REFERENCES inventory_deliveries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verify: confirm the table now exists with the expected column count.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  column_count INT;
BEGIN
  SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'inventory_returns';

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'inventory_returns table migration complete.';
  RAISE NOTICE '  Columns present: %', column_count;
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • No backfill needed — this is a brand-new, empty table.
--   • The application's TypeORM `synchronize` (dev only) already creates
--     this table automatically in local/dev databases; this migration is
--     for environments (e.g. production) where synchronize is disabled.
--   • Corresponding entity: apps/backend-api/src/entities/inventory-return.entity.ts
-- =============================================================================
