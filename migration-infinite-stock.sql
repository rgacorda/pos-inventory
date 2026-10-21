-- =============================================================================
-- Migration: Unlimited stock on products
--
-- Adds a flag so a product can be sold without a tracked quantity. Existing
-- products stay quantity-tracked (false).
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-infinite-stock.sql
--
-- Safe to re-run: ADD COLUMN uses IF NOT EXISTS.
-- =============================================================================

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "infiniteStock" boolean NOT NULL DEFAULT false;

COMMIT;
