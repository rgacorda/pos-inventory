-- =============================================================================
-- Migration: Variance inventory counts
--
-- Background: Managers record a physical stock count. Admins compare that
--             count with system stock and apply it, which sets the product
--             quantity to the counted quantity.
--
-- Adds:
--   inventory_variance_counts
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-inventory-variances.sql
--
-- Safe to re-run: CREATE TABLE / CREATE INDEX use IF NOT EXISTS.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS inventory_variance_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "countedQuantity" integer NOT NULL,
  "systemQuantity" integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  "countedByUserId" uuid NOT NULL,
  "appliedByUserId" uuid NULL,
  "appliedAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_inventory_variance_counts_organizationId"
  ON inventory_variance_counts ("organizationId");

CREATE INDEX IF NOT EXISTS "IDX_inventory_variance_counts_productId"
  ON inventory_variance_counts ("productId");

CREATE INDEX IF NOT EXISTS "IDX_inventory_variance_counts_org_product_status"
  ON inventory_variance_counts ("organizationId", "productId", status);

-- One open count per product. Applied counts stay as history.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_inventory_variance_counts_pending_product"
  ON inventory_variance_counts ("organizationId", "productId")
  WHERE status = 'PENDING';

COMMIT;
