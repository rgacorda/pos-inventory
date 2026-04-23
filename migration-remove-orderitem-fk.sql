-- Migration: Remove foreign key constraint on order_items.productId
-- Purpose: Allow manual items (refrigeration fees, etc.) that don't exist in products table
-- Date: 2026-04-23

-- Drop the foreign key constraint if it exists
DO $$ 
BEGIN
    -- Find and drop the foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%order_items%productId%' 
        AND table_name = 'order_items'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE order_items DROP CONSTRAINT ' || constraint_name 
            FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%order_items%productId%' 
            AND table_name = 'order_items'
            AND constraint_type = 'FOREIGN KEY'
            LIMIT 1
        );
    END IF;
END $$;

-- Make productId nullable to support manual items
ALTER TABLE order_items ALTER COLUMN "productId" DROP NOT NULL;

-- Verify the changes
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'order_items' 
AND column_name = 'productId';

-- Show foreign keys on order_items table (should not include productId)
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'order_items';
