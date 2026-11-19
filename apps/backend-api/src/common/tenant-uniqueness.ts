import { DataSource } from 'typeorm';

/**
 * SKU, order number, and email used to be unique for the whole database.
 * They are unique inside one organization. A single-store database already
 * satisfies that, so this only replaces indexes and does not rewrite rows.
 * Platform accounts have no organization, and their emails stay unique too.
 */
export async function applyTenantUniqueness(dataSource: DataSource): Promise<void> {
  const query = dataSource.createQueryRunner();
  await query.connect();
  await query.startTransaction();
  try {
    await query.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM products
          GROUP BY "organizationId", sku
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate SKUs inside one organization';
        END IF;

        IF EXISTS (
          SELECT 1 FROM orders
          GROUP BY "organizationId", "orderNumber"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate order numbers inside one organization';
        END IF;

        IF EXISTS (
          SELECT 1 FROM users
          GROUP BY "organizationId", email
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate emails inside one organization';
        END IF;
      END $$;
    `);

    await replaceSingleColumnUnique(query, 'products', 'sku', [
      'organizationId',
      'sku',
    ], 'UQ_products_organization_sku');
    await replaceSingleColumnUnique(query, 'orders', 'orderNumber', [
      'organizationId',
      'orderNumber',
    ], 'UQ_orders_organization_order_number');
    await replaceSingleColumnUnique(query, 'users', 'email', [
      'organizationId',
      'email',
    ], 'UQ_users_organization_email');

    await query.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_platform_email"
      ON users (email)
      WHERE "organizationId" IS NULL
    `);

    await query.commitTransaction();
  } catch (error) {
    await query.rollbackTransaction();
    throw error;
  } finally {
    await query.release();
  }
}

function sqlIdent(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return value;
}

async function replaceSingleColumnUnique(
  query: { query: (sql: string) => Promise<unknown> },
  table: string,
  column: string,
  nextColumns: string[],
  nextIndex: string,
): Promise<void> {
  const safeTable = sqlIdent(table);
  const safeColumn = sqlIdent(column);
  const safeIndex = sqlIdent(nextIndex);
  const safeNextColumns = nextColumns.map(sqlIdent);

  await query.query(`
    DO $$
    DECLARE
      constraint_name text;
      index_name text;
    BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = '${safeTable}'
          AND c.contype = 'u'
          AND (
            SELECT array_agg(a.attname ORDER BY u.ord)
            FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = u.attnum
          ) = ARRAY['${safeColumn}']::name[]
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${safeTable}', constraint_name);
      END LOOP;

      FOR index_name IN
        SELECT ic.relname
        FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_class ic ON ic.oid = ix.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = '${safeTable}'
          AND ix.indisunique
          AND NOT ix.indisprimary
          AND ix.indpred IS NULL
          AND ic.relname <> '${safeIndex}'
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint c WHERE c.conindid = ix.indexrelid
          )
          AND (
            SELECT array_agg(a.attname ORDER BY k.ord)
            FROM unnest(ix.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a
              ON a.attrelid = t.oid AND a.attnum = k.attnum
            WHERE k.attnum > 0
          ) = ARRAY['${safeColumn}']::name[]
      LOOP
        EXECUTE format('DROP INDEX %I', index_name);
      END LOOP;
    END $$;
  `);

  const columnList = safeNextColumns.map((name) => `"${name}"`).join(', ');
  await query.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "${safeIndex}" ON "${safeTable}" (${columnList})`,
  );
}
