-- Add superadmin role to users check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'));
