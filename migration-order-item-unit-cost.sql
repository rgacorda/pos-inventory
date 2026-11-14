-- =============================================================================
-- Migration: Freeze the unit cost on each sale
--
-- Profit and loss reads order_items."unitCost" instead of the product's
-- current cost. This adds that column, an index on order_items."orderId",
-- and copies today's product cost onto existing sale lines and onto
-- exchange returns that came from those lines.
--
-- Sales can keep syncing while this runs. The column add takes a brief
-- exclusive lock. The index is built without blocking writes. Cost copies
-- commit in batches, so a long run does not hold one lock across the
-- whole history, and a re-run continues where the last one stopped.
--
--   docker exec -i pos-postgres psql -U pos_user -d pos_db \
--     -v ON_ERROR_STOP=1 \
--     < ~/production/pos-system/migration-order-item-unit-cost.sql
--
-- Safe to re-run. A cost already stored on a line or a return is kept.
-- =============================================================================

\set ON_ERROR_STOP on

-- Nullable column with no default. PostgreSQL updates the catalog only;
-- it does not rewrite order_items. Fail instead of queueing behind a
-- long lock and blocking the register.
SET lock_timeout = '15s';
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS "unitCost" numeric(10, 2);
RESET lock_timeout;

-- Returns are costed by looking up the sale's lines. Without this index
-- that lookup scans every line once per returned item.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_order_items_orderId"
  ON order_items ("orderId");

CREATE OR REPLACE PROCEDURE backfill_order_item_unit_cost()
LANGUAGE plpgsql
AS $$
DECLARE
  copied int;
  batches int := 0;
BEGIN
  LOOP
    UPDATE order_items AS item
    SET "unitCost" = ROUND(COALESCE(product.cost, 0)::numeric, 2)
    FROM orders AS sale, products AS product
    WHERE item.id IN (
      SELECT pending.id
      FROM order_items AS pending
      JOIN orders AS pending_sale ON pending_sale.id = pending."orderId"
      JOIN products AS pending_product
        ON pending_product.id::text = pending."productId"
       AND pending_product."organizationId" = pending_sale."organizationId"
      WHERE pending."unitCost" IS NULL
        AND COALESCE(pending."productId", '') <> ''
        AND pending."productId" NOT LIKE 'manual-%'
      LIMIT 10000
    )
      AND sale.id = item."orderId"
      AND product.id::text = item."productId"
      AND product."organizationId" = sale."organizationId";

    GET DIAGNOSTICS copied = ROW_COUNT;
    EXIT WHEN copied = 0;

    batches := batches + 1;
    RAISE NOTICE 'sale lines: copied % costs (batch %)', copied, batches;
    COMMIT;

    IF batches > 100000 THEN
      RAISE EXCEPTION 'sale-line backfill did not finish';
    END IF;
  END LOOP;
END;
$$;

CALL backfill_order_item_unit_cost();
DROP PROCEDURE backfill_order_item_unit_cost();

CREATE OR REPLACE PROCEDURE backfill_return_unit_cost()
LANGUAGE plpgsql
AS $$
DECLARE
  copied int;
  batches int := 0;
BEGIN
  LOOP
    -- Only orders that still have a returned line whose sale cost we can
    -- copy. A return with no matching sale line is left alone, so this
    -- cannot spin on rows that will never change.
    UPDATE orders AS sale
    SET "returnedItems" = (
      SELECT jsonb_agg(
               CASE
                 WHEN jsonb_typeof(elem) <> 'object' THEN elem
                 WHEN elem ? 'unitCost'
                  AND jsonb_typeof(elem -> 'unitCost') = 'number' THEN elem
                 WHEN costs.unit_cost IS NULL THEN elem
                 ELSE elem || jsonb_build_object('unitCost', costs.unit_cost)
               END
               ORDER BY ordinality
             )
      FROM jsonb_array_elements(sale."returnedItems") WITH ORDINALITY AS line(elem, ordinality)
      LEFT JOIN LATERAL (
        SELECT ROUND(
                 SUM(item.quantity * item."unitCost")
                   / NULLIF(SUM(item.quantity), 0),
                 2
               ) AS unit_cost
        FROM order_items AS item
        WHERE item."orderId" = sale.id
          AND item."productId" = elem ->> 'productId'
          AND item."unitCost" IS NOT NULL
      ) AS costs ON true
    )
    WHERE sale.id IN (
      SELECT pending.id
      FROM orders AS pending
      WHERE pending."returnedItems" IS NOT NULL
        AND jsonb_typeof(pending."returnedItems") = 'array'
        AND jsonb_array_length(pending."returnedItems") > 0
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(pending."returnedItems") AS elem
          JOIN order_items AS item
            ON item."orderId" = pending.id
           AND item."productId" = elem ->> 'productId'
           AND item."unitCost" IS NOT NULL
          WHERE jsonb_typeof(elem) = 'object'
            AND NOT (
              elem ? 'unitCost'
              AND jsonb_typeof(elem -> 'unitCost') = 'number'
            )
        )
      LIMIT 1000
    );

    GET DIAGNOSTICS copied = ROW_COUNT;
    EXIT WHEN copied = 0;

    batches := batches + 1;
    RAISE NOTICE 'exchanges: stamped % orders (batch %)', copied, batches;
    COMMIT;

    IF batches > 100000 THEN
      RAISE EXCEPTION 'exchange backfill did not finish';
    END IF;
  END LOOP;
END;
$$;

CALL backfill_return_unit_cost();
DROP PROCEDURE backfill_return_unit_cost();
