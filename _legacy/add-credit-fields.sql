-- Migration: Add credit fields to customers table
-- This enables the credit/fiado payment method functionality

-- Add credit_balance column to track current debt
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Add credit_limit column to set maximum credit allowed
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Create index for faster queries on customers with credit balance
CREATE INDEX IF NOT EXISTS idx_customers_credit_balance 
ON customers(tenant_id, credit_balance) 
WHERE credit_balance > 0;

-- Add comment to document the fields
COMMENT ON COLUMN customers.credit_balance IS 'Current credit balance (debt) of the customer';
COMMENT ON COLUMN customers.credit_limit IS 'Maximum credit limit allowed for the customer';
