-- Consistency test for migration-order-item-unit-cost.sql.
-- Builds a throwaway schema, runs the migration twice, and checks that
-- frozen costs match what profit and loss will read.
--
--   docker exec -i pos-migration-test psql -U postgres -d pos_test \
--     -v ON_ERROR_STOP=1 \
--     < migration-order-item-unit-cost.test.sql

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id uuid PRIMARY KEY,
  "organizationId" text NOT NULL,
  cost numeric(14, 4)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  "organizationId" text NOT NULL,
  "returnedItems" jsonb,
  "exchangedAt" timestamp
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  "orderId" uuid NOT NULL,
  "productId" varchar,
  quantity integer NOT NULL,
  name text NOT NULL
);

INSERT INTO products (id, "organizationId", cost) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'org-a', 40.50),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'org-a', NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'org-a', 10.126),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'org-b', 99.00),
  ('11111111-1111-4111-8111-111111111111', 'org-bulk', 3.25);

INSERT INTO orders (id, "organizationId", "returnedItems", "exchangedAt") VALUES
  ('10000000-0000-4000-8000-000000000001', 'org-a', NULL, NULL),
  (
    '10000000-0000-4000-8000-000000000002',
    'org-a',
    '[
      {"productId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","name":"Soap","sku":"S","quantity":2,"unitPrice":80,"total":160,"note":"keep"},
      {"productId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","name":"Held","sku":"H","quantity":1,"unitPrice":10,"total":10,"unitCost":7},
      {"productId":"cccccccc-cccc-4ccc-8ccc-ccccccccccc1","name":"Gone","sku":"G","quantity":1,"unitPrice":5,"total":5},
      "not-an-item"
    ]'::jsonb,
    '2026-11-01 12:00:00'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'org-a',
    '[{"productId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","name":"Soap","quantity":1,"unitPrice":80,"total":80}]'::jsonb,
    NULL
  );

-- Lines whose cost was already snapshotted must survive the backfill.
ALTER TABLE order_items ADD COLUMN "unitCost" numeric(10, 2);

INSERT INTO order_items (id, "orderId", "productId", quantity, name, "unitCost") VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 2, 'soap', NULL),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 1, 'no-cost', NULL),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 4, 'rounded', NULL),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 1, 'other-org', NULL),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'manual-fee', 1, 'manual', NULL),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '', 1, 'blank', NULL),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 1, 'deleted-product', NULL),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'not-a-uuid', 1, 'bad-id', NULL),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 1, 'already-saved', 12.34),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 1, 'return-a', 10.00),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 3, 'return-b', 20.00),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 1, 'exchange-child', 5.00);

INSERT INTO orders (id, "organizationId")
SELECT
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'org-bulk'
FROM generate_series(1, 1000) AS n;

INSERT INTO order_items (id, "orderId", "productId", quantity, name)
SELECT
  gen_random_uuid(),
  ('00000000-0000-4000-8000-' || lpad(((n - 1) / 100 + 1)::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  1,
  'bulk'
FROM generate_series(1, 100000) AS n;

UPDATE orders
SET "returnedItems" = jsonb_build_array(
      jsonb_build_object(
        'productId', '11111111-1111-4111-8111-111111111111',
        'name', 'Bulk',
        'quantity', 1,
        'unitPrice', 10,
        'total', 10
      )
    ),
    "exchangedAt" = '2026-11-02 08:00:00'
WHERE "organizationId" = 'org-bulk'
  AND id IN (
    SELECT id FROM orders WHERE "organizationId" = 'org-bulk' ORDER BY id LIMIT 500
  );

\echo '---- migration, first run ----'
\i migration-order-item-unit-cost.sql

CREATE OR REPLACE FUNCTION assert_same(label text, actual numeric, expected numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION '%: expected %, got %', label, expected, actual;
  END IF;
END;
$$;

SELECT assert_same('copies the product cost', (SELECT "unitCost" FROM order_items WHERE name = 'soap'), 40.50);
SELECT assert_same('null product cost freezes at zero', (SELECT "unitCost" FROM order_items WHERE name = 'no-cost'), 0);
SELECT assert_same('rounds half up to cents', (SELECT "unitCost" FROM order_items WHERE name = 'rounded'), 10.13);
SELECT assert_same('keeps a cost already saved', (SELECT "unitCost" FROM order_items WHERE name = 'already-saved'), 12.34);
SELECT assert_same('bulk lines', (SELECT COUNT(*) FROM order_items WHERE name = 'bulk' AND "unitCost" = 3.25), 100000);
SELECT assert_same('other organization stays empty', (SELECT "unitCost" FROM order_items WHERE name = 'other-org'), NULL);
SELECT assert_same('manual line stays empty', (SELECT "unitCost" FROM order_items WHERE name = 'manual'), NULL);
SELECT assert_same('blank product stays empty', (SELECT "unitCost" FROM order_items WHERE name = 'blank'), NULL);
SELECT assert_same('deleted product stays empty', (SELECT "unitCost" FROM order_items WHERE name = 'deleted-product'), NULL);
SELECT assert_same('bad product id stays empty', (SELECT "unitCost" FROM order_items WHERE name = 'bad-id'), NULL);

SELECT assert_same(
  'return uses the weighted sale cost',
  (
    SELECT (elem ->> 'unitCost')::numeric
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND elem ->> 'name' = 'Soap'
  ),
  17.50
);
SELECT assert_same(
  'return keeps a cost already saved',
  (
    SELECT (elem ->> 'unitCost')::numeric
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND elem ->> 'name' = 'Held'
  ),
  7
);
SELECT assert_same(
  'return without a sale line is not given a cost',
  (
    SELECT CASE WHEN elem ? 'unitCost' THEN 1 ELSE 0 END
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND elem ->> 'name' = 'Gone'
  ),
  0
);
SELECT assert_same(
  'non-item return entry is kept',
  (
    SELECT COUNT(*)
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") WITH ORDINALITY AS line(elem, ordinality)
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND ordinality = 4
      AND elem = '"not-an-item"'::jsonb
  ),
  1
);
SELECT assert_same(
  'return fields besides cost are kept',
  (
    SELECT COUNT(*)
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND elem ->> 'name' = 'Soap'
      AND elem ->> 'sku' = 'S'
      AND elem ->> 'note' = 'keep'
      AND (elem ->> 'quantity')::numeric = 2
      AND (elem ->> 'unitPrice')::numeric = 80
  ),
  1
);
SELECT assert_same(
  'exchange checkout is not costed from its new lines',
  (
    SELECT CASE WHEN elem ? 'unitCost' THEN 1 ELSE 0 END
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE id = '10000000-0000-4000-8000-000000000003'
      AND elem ->> 'productId' = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  0
);
SELECT assert_same(
  'bulk returns',
  (
    SELECT COUNT(*)
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE "organizationId" = 'org-bulk'
      AND (elem ->> 'unitCost')::numeric = 3.25
  ),
  500
);

-- Profit and loss sold cost, then the same lines after the product cost changes.
SELECT assert_same(
  'sold cost uses the saved unit cost',
  (
    SELECT SUM(quantity * CASE
             WHEN "unitCost" IS NOT NULL THEN "unitCost"
             ELSE 0
           END)
    FROM order_items
    WHERE name IN ('soap', 'already-saved')
  ),
  93.34
);

UPDATE products
SET cost = 1
WHERE "organizationId" = 'org-a'
   OR "organizationId" = 'org-bulk';

\echo '---- migration, second run ----'
\i migration-order-item-unit-cost.sql

SELECT assert_same('second run keeps soap', (SELECT "unitCost" FROM order_items WHERE name = 'soap'), 40.50);
SELECT assert_same('second run keeps zero', (SELECT "unitCost" FROM order_items WHERE name = 'no-cost'), 0);
SELECT assert_same('second run keeps saved cost', (SELECT "unitCost" FROM order_items WHERE name = 'already-saved'), 12.34);
SELECT assert_same('second run keeps bulk', (SELECT COUNT(*) FROM order_items WHERE name = 'bulk' AND "unitCost" = 3.25), 100000);
SELECT assert_same(
  'second run keeps the return cost',
  (
    SELECT (elem ->> 'unitCost')::numeric
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND elem ->> 'name' = 'Soap'
  ),
  17.50
);
SELECT assert_same(
  'a later product cost does not change sold cost',
  (
    SELECT SUM(quantity * CASE
             WHEN "unitCost" IS NOT NULL THEN "unitCost"
             ELSE COALESCE(cost, 0)
           END)
    FROM order_items
    LEFT JOIN products ON products.id::text = order_items."productId"
    WHERE name IN ('soap', 'already-saved')
  ),
  93.34
);
SELECT assert_same(
  'a later product cost does not change returned cost',
  (
    SELECT SUM(
      CASE
        WHEN elem ->> 'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (elem ->> 'quantity')::numeric
        ELSE 0
      END * COALESCE(
        CASE
          WHEN elem ->> 'unitCost' ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (elem ->> 'unitCost')::numeric
        END,
        (
          SELECT SUM(item.quantity * item."unitCost") / NULLIF(SUM(item.quantity), 0)
          FROM order_items AS item
          WHERE item."orderId" = orders.id
            AND item."productId" = elem ->> 'productId'
            AND item."unitCost" IS NOT NULL
        ),
        products.cost,
        0
      )
    )
    FROM orders
    CROSS JOIN LATERAL jsonb_array_elements("returnedItems") AS elem
    LEFT JOIN products
      ON products.id::text = elem ->> 'productId'
     AND products."organizationId" = orders."organizationId"
    WHERE orders.id = '10000000-0000-4000-8000-000000000002'
      AND elem ->> 'name' = 'Soap'
  ),
  35.00
);

SELECT assert_same(
  'return lookup can use the order index',
  (
    SELECT COUNT(*)
    FROM pg_indexes
    WHERE tablename = 'order_items'
      AND indexname = 'IDX_order_items_orderId'
  ),
  1
);

\echo '---- return lookup plan ----'
EXPLAIN (COSTS OFF)
SELECT item."unitCost"
FROM orders AS sale
CROSS JOIN LATERAL jsonb_array_elements(sale."returnedItems") AS elem
JOIN order_items AS item
  ON item."orderId" = sale.id
 AND item."productId" = elem ->> 'productId'
WHERE sale."organizationId" = 'org-bulk'
LIMIT 5;

DROP FUNCTION assert_same(text, numeric, numeric);

\echo '---- consistency checks passed ----'
