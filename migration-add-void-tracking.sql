-- Migration: Add void tracking fields to orders table
-- Date: 2026-05-03
-- Description: Adds voidedBy and voidedAt columns to track who voided orders and when

-- Add voidedBy column (references users table)
ALTER TABLE orders
ADD COLUMN "voidedBy" uuid NULL;

-- Add voidedAt timestamp column
ALTER TABLE orders
ADD COLUMN "voidedAt" timestamp NULL;

-- Add foreign key constraint for voidedBy
ALTER TABLE orders
ADD CONSTRAINT "FK_orders_voidedBy" 
FOREIGN KEY ("voidedBy") 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Add index on voidedAt for faster queries of voided orders
CREATE INDEX "IDX_orders_voidedAt" ON orders("voidedAt");

-- Add comment to document the purpose
COMMENT ON COLUMN orders."voidedBy" IS 'User ID who voided this order';
COMMENT ON COLUMN orders."voidedAt" IS 'Timestamp when order was voided';
