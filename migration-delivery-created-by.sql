-- =============================================================================
-- Migration: Record who created an inventory delivery
--
-- Adds the creator id and display name. Existing deliveries stay valid
-- with both columns null.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-delivery-created-by.sql
--
-- Safe to re-run: ADD COLUMN uses IF NOT EXISTS.
-- =============================================================================

BEGIN;

ALTER TABLE inventory_deliveries
  ADD COLUMN IF NOT EXISTS "createdByUserId" uuid,
  ADD COLUMN IF NOT EXISTS "createdByName" character varying(255);

COMMIT;
