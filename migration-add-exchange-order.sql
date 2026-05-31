-- Migration: Add exchange order support
-- Date: 2026-05-30
-- Description: Adds EXCHANGE status to order_status enum and exchange tracking
--              columns (exchangeRef, exchangedAt) to the orders table.
--              Also creates the index used by GET /orders?exchangeRef=... queries.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend the order status enum with EXCHANGE
--    TypeORM names the enum type  orders_status_enum  by convention.
--    The DO block skips gracefully if the value already exists.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'orders_status_enum'
          AND e.enumlabel = 'EXCHANGE'
    ) THEN
        ALTER TYPE orders_status_enum ADD VALUE 'EXCHANGE';
    END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add exchangeRef column
--    Stores the orderNumber of the original transaction being exchanged.
--    Plain VARCHAR — no FK, because the original order may live on a different
--    terminal or in a different day's data set.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS "exchangeRef" VARCHAR(64) NULL;

COMMENT ON COLUMN orders."exchangeRef" IS
    'orderNumber of the original transaction this exchange was created from';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add exchangedAt column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS "exchangedAt" TIMESTAMP WITH TIME ZONE NULL;

COMMENT ON COLUMN orders."exchangedAt" IS
    'Timestamp when the exchange was processed at the POS terminal';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Index on exchangeRef for fast reverse-lookup
--    (e.g. "show all exchanges for order ORD-1234567890")
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "IDX_orders_exchangeRef"
    ON orders("exchangeRef")
    WHERE "exchangeRef" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Verify
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('exchangeRef', 'exchangedAt', 'status')
ORDER BY column_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually if you need to undo — PostgreSQL does NOT support
-- removing enum values, so the enum change is irreversible without a dump/restore)
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS "IDX_orders_exchangeRef";
-- ALTER TABLE orders DROP COLUMN IF EXISTS "exchangedAt";
-- ALTER TABLE orders DROP COLUMN IF EXISTS "exchangeRef";
-- NOTE: EXCHANGE cannot be removed from orders_status_enum without a full
--       enum type recreation. Leave it in place; unused values are harmless.
