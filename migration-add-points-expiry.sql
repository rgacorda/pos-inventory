-- Migration: Add loyalty points expiry support
-- Run this against your PostgreSQL database after migration-add-customer-points.sql

-- 1. Add expiry columns to customer_point_transactions
ALTER TABLE customer_point_transactions
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP;

-- EARN transactions that have been processed by the expiry cron will have expiredAt set
CREATE INDEX IF NOT EXISTS idx_cpt_expires ON customer_point_transactions ("expiresAt")
  WHERE "expiresAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cpt_expired_unprocessed ON customer_point_transactions ("expiresAt", "expiredAt")
  WHERE type = 'EARN' AND "expiresAt" IS NOT NULL AND "expiredAt" IS NULL;

-- 2. Extend the type enum to include EXPIRE
-- PostgreSQL requires adding the new value to the existing enum
ALTER TYPE customer_point_transactions_type_enum ADD VALUE IF NOT EXISTS 'EXPIRE';
