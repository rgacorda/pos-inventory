-- =============================================================================
-- Migration: Archive records and edit history
--
-- Adds soft-delete columns so deleting a product, delivery, or return hides
-- it and records who archived it. Also stores edit history for products and
-- deliveries, plus the time an admin dismissed the Edited label.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-archive-and-edits.sql
--
-- Safe to re-run: ADD COLUMN uses IF NOT EXISTS.
-- =============================================================================

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" uuid NULL,
  ADD COLUMN IF NOT EXISTS "deletedByName" varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS "editHistory" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "editHistoryDismissedAt" timestamp NULL;

ALTER TABLE inventory_deliveries
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" uuid NULL,
  ADD COLUMN IF NOT EXISTS "deletedByName" varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS "editHistory" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "editHistoryDismissedAt" timestamp NULL;

ALTER TABLE inventory_returns
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" uuid NULL,
  ADD COLUMN IF NOT EXISTS "deletedByName" varchar(255) NULL;

COMMIT;
