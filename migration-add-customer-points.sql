-- Migration: Add customer loyalty points system
-- Run this against your PostgreSQL database

-- 1. Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_customers_phone_org UNIQUE ("organizationId", phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_org ON customers ("organizationId");
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

-- 2. Create customer_point_transactions table
CREATE TABLE IF NOT EXISTS customer_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  "orderId" UUID REFERENCES orders(id) ON DELETE SET NULL,
  "organizationId" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('EARN', 'REDEEM')),
  points INTEGER NOT NULL,
  description VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpt_customer ON customer_point_transactions ("customerId");
CREATE INDEX IF NOT EXISTS idx_cpt_order ON customer_point_transactions ("orderId");
CREATE INDEX IF NOT EXISTS idx_cpt_org ON customer_point_transactions ("organizationId");

-- 3. Add customer loyalty columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "customerId" UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER,
  ADD COLUMN IF NOT EXISTS "pointsRedeemed" INTEGER;

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders ("customerId");
