-- =============================================================================
-- Migration: Keep cashier name on orders after the user account is deleted
--
-- Adds:
--   orders."cashierName"
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-order-cashier-name.sql
--
-- Safe to re-run: ADD COLUMN uses IF NOT EXISTS.
-- =============================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "cashierName" character varying;

-- Copy the current cashier name onto existing orders.
UPDATE orders AS o
SET "cashierName" = u.name
FROM users AS u
WHERE o."cashierId" = u.id
  AND (o."cashierName" IS NULL OR o."cashierName" = '');

COMMIT;
