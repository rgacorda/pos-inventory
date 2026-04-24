-- Migration: Add convenience markup columns to products table
-- Date: 2026-04-24
-- Description: Adds convenienceMarkupPercentage and convenienceMarkup columns to support convenience store markup pricing

-- Add convenienceMarkupPercentage column to products table
ALTER TABLE products 
ADD COLUMN "convenienceMarkupPercentage" NUMERIC(5,2);

-- Add convenienceMarkup column to products table
ALTER TABLE products 
ADD COLUMN "convenienceMarkup" NUMERIC(10,2) DEFAULT 0;

-- Add comments to the columns
COMMENT ON COLUMN products."convenienceMarkupPercentage" IS 'Optional convenience markup percentage (e.g., 5 for 5%)';
COMMENT ON COLUMN products."convenienceMarkup" IS 'Optional convenience markup fixed amount';

-- Update any NULL values to 0 for convenienceMarkup (though default should handle this)
UPDATE products 
SET "convenienceMarkup" = 0 
WHERE "convenienceMarkup" IS NULL;
