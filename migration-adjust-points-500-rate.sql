-- =============================================================================
-- Migration: Adjust existing customer points from ₱200/pt to ₱500/pt rate
--
-- Background: Points were previously earned at 1 pt per ₱200 spent.
--             The rate has been changed to 1 pt per ₱500 spent.
--             This migration recalculates all historical earn transactions
--             and corrects each customer's current point balance for fairness.
--
-- Run:
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     < ~/production/pos-system/migration-adjust-points-500-rate.sql
--
-- Safe to re-run: all UPDATE statements are idempotent.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Recalculate points on all EARN transactions linked to an order.
--    Both unexpired (active) and already-expired records are updated so
--    the historical ledger reflects the corrected rate.
-- ---------------------------------------------------------------------------
UPDATE customer_point_transactions cpt
SET
  points      = FLOOR(o."totalAmount" / 500),
  description = regexp_replace(
                  cpt.description,
                  '^Earned \d+ pts',
                  'Earned ' || FLOOR(o."totalAmount" / 500)::text || ' pts'
                )
FROM orders o
WHERE cpt."orderId" = o.id
  AND cpt.type = 'EARN';

-- ---------------------------------------------------------------------------
-- 2. Recalculate points on EXPIRE records that are linked to an order.
--    An EXPIRE record's value should not exceed the corrected EARN amount
--    for that order (it may be less if the customer balance was low at
--    expiry time — we preserve that proportional reduction).
-- ---------------------------------------------------------------------------
UPDATE customer_point_transactions expire_tx
SET points = LEAST(
  expire_tx.points,
  FLOOR(o."totalAmount" / 500)
)
FROM orders o
WHERE expire_tx."orderId" = o.id
  AND expire_tx.type      = 'EXPIRE'
  AND expire_tx.points    > 0;

-- ---------------------------------------------------------------------------
-- 3. Update orders.pointsEarned to reflect the corrected rate.
-- ---------------------------------------------------------------------------
UPDATE orders
SET "pointsEarned" = FLOOR("totalAmount" / 500)
WHERE "pointsEarned" IS NOT NULL
  AND "pointsEarned" > 0;

-- ---------------------------------------------------------------------------
-- 4. Recalculate each customer's totalPoints from the corrected ledger.
--
--    Formula:
--      totalPoints = MAX(0,
--        SUM(active EARN points)   -- EARN rows where expiredAt IS NULL
--        - SUM(REDEEM points)      -- points the customer already spent
--      )
--
--    EARN rows with expiredAt IS NOT NULL are excluded because the expiry
--    cron already deducted those from the balance when it created the
--    paired EXPIRE record. EXPIRE rows are therefore NOT subtracted again
--    to avoid double-counting.
-- ---------------------------------------------------------------------------
WITH new_balances AS (
  SELECT
    cpt."customerId",
    GREATEST(0,
      COALESCE(SUM(CASE WHEN cpt.type = 'EARN' AND cpt."expiredAt" IS NULL
                        THEN cpt.points ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN cpt.type = 'REDEEM'
                          THEN cpt.points ELSE 0 END), 0)
    ) AS new_total
  FROM customer_point_transactions cpt
  GROUP BY cpt."customerId"
)
UPDATE customers c
SET "totalPoints" = nb.new_total
FROM new_balances nb
WHERE c.id = nb."customerId";

-- ---------------------------------------------------------------------------
-- 5. Verify: show a summary of affected rows
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  earn_count    INT;
  expire_count  INT;
  order_count   INT;
  cust_count    INT;
BEGIN
  SELECT COUNT(*) INTO earn_count
    FROM customer_point_transactions WHERE type = 'EARN' AND "orderId" IS NOT NULL;

  SELECT COUNT(*) INTO expire_count
    FROM customer_point_transactions WHERE type = 'EXPIRE' AND "orderId" IS NOT NULL;

  SELECT COUNT(*) INTO order_count
    FROM orders WHERE "pointsEarned" IS NOT NULL AND "pointsEarned" >= 0;

  SELECT COUNT(*) INTO cust_count
    FROM customers;

  RAISE NOTICE '-----------------------------------------------';
  RAISE NOTICE 'Points rate migration (₱200 → ₱500) complete.';
  RAISE NOTICE '  EARN transactions updated : %', earn_count;
  RAISE NOTICE '  EXPIRE transactions capped : %', expire_count;
  RAISE NOTICE '  Orders pointsEarned updated: %', order_count;
  RAISE NOTICE '  Customer balances refreshed: %', cust_count;
  RAISE NOTICE '-----------------------------------------------';
END $$;

COMMIT;

-- =============================================================================
-- Post-migration notes:
--   • Customer point balances are now based on 1 pt per ₱500 spent.
--   • Redeemed points are preserved as-is (those transactions are done).
--   • Run a full sync on all POS terminals after applying this migration
--     so cached loyalty data is refreshed.
-- =============================================================================
