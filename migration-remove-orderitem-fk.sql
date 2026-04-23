-- Migration: Remove foreign key constraint on order_items.productId
-- Purpose: Allow manual items (refrigeration fees, etc.) that don't exist in products table
-- TypeORM will still define the relation, but DB won't enforce FK constraint
-- Date: 2026-04-23

-- Step 1: Drop the foreign key constraint if it exists
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all foreign key constraints on productId column
    FOR constraint_record IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'order_items'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'productId'
    LOOP
        EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT ' || constraint_record.constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Step 2: Make productId nullable to support manual items
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
