-- Fix: Ensure payment_method column accepts 'credit' value
-- This script checks and updates the constraint on the sales table

-- First, check current constraint (PostgreSQL)
-- If there's a CHECK constraint, we need to update it

-- Option 1: Drop and recreate the column with correct constraint
-- (Only if the column has a CHECK constraint that excludes 'credit')

-- Check if there's a constraint
-- \d sales

-- If needed, alter the column to ensure it accepts 'credit'
ALTER TABLE sales 
DROP CONSTRAINT IF EXISTS sales_payment_method_check;

-- Add new constraint with 'credit' included
ALTER TABLE sales 
ADD CONSTRAINT sales_payment_method_check 
CHECK (payment_method IN ('cash', 'card', 'transfer', 'digital', 'credit'));

-- Or simply alter the column without constraint (if using application-level validation)
-- ALTER TABLE sales ALTER COLUMN payment_method TYPE VARCHAR(50);

-- Verify the change
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'sales' AND column_name = 'payment_method';
