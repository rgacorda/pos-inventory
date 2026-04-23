-- Migration: Add addonPrice column to products table
-- Purpose: Allow products to have optional add-on fees (refrigeration, cooling, etc.)
-- Date: 2026-04-23

-- Add addonPrice column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS "addonPrice" DECIMAL(10,2) DEFAULT 0;

-- Update existing products to have 0 as default
UPDATE products 
SET "addonPrice" = 0 
WHERE "addonPrice" IS NULL;

-- Verify the change
SELECT 
    column_name, 
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'addonPrice';
