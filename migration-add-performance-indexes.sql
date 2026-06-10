-- Performance indexes for dashboard, reports, and financials queries
-- Adds composite indexes on the most frequent filter patterns:
--   (organizationId, createdAt) for date-range queries
--   (organizationId, status, createdAt) for status-filtered date queries
--   (organizationId, createdAt, status) for payments

-- Orders: date-range queries (dashboard today stats, report analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_created_at
  ON orders ("organizationId", "createdAt" DESC);

-- Orders: status + date filter (financials P&L, order stats)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_status_created_at
  ON orders ("organizationId", status, "createdAt" DESC);

-- Order items: join + date filter (top products analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items ("orderId");

-- Payments: date-range queries (payment method stats)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_org_created_at
  ON payments ("organizationId", "createdAt" DESC);

-- Payments: status + date filter (payment stats, method stats)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_org_status_created_at
  ON payments ("organizationId", status, "createdAt" DESC);

-- Inventory deliveries: date + status filter (COGS in financials)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_deliveries_org_date_status
  ON inventory_deliveries ("organizationId", "deliveryDate" DESC, status);

-- Expenses: date filter (operating expenses in financials)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_org_date
  ON expenses ("organizationId", "expenseDate" DESC);
