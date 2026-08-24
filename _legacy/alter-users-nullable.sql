d-- Script para hacer tenant_id nullable en la tabla users
-- Esto permite crear usuarios desarrolladores/superadmins sin asociación a un tenant

-- PostgreSQL
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- MySQL (si usas MySQL, ejecuta esta en lugar de la anterior)
-- ALTER TABLE users MODIFY tenant_id VARCHAR(36) NULL;

-- Verificar el cambio
-- SELECT column_name, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'tenant_id';
