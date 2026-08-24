-- =====================================================
-- Script para crear un nuevo tenant con su owner
-- Ejecución en PostgreSQL
-- =====================================================

-- Variables (cambia estos valores)
-- :tenant_name, :tenant_slug, :business_name
-- :owner_name, :owner_email, :owner_password

-- 1. Crear el tenant
INSERT INTO tenants (
  id,
  name,
  slug,
  business_name,
  address,
  phone,
  plan,
  subscription_status,
  trial_ends_at,
  is_active,
  max_products,
  max_users,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Salsamentaría Demo',
  'demo',
  'Salsamentaría Demo C.A.',
  'Calle 123 # 45-67, Bogotá',
  '3001234567',
  'free',
  'active',
  '2026-03-26 15:48:56.337 -0500',
  true,
  100,
  5,
  NOW(),
  NOW()
)
RETURNING id;

-- 2. Crear el usuario owner (reemplaza :tenant_id con el ID del tenant creado)
-- Nota: La contraseña se hashea con bcrypt, aquí está el hash para 'demo123'
INSERT INTO users (
  id,
  tenant_id,
  email,
  password_hash,
  name,
  role,
  is_active,
  is_superadmin,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  :tenant_id,  -- REEMPLAZAR CON EL ID DEL TENANT
  'admin@demo.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIaHJt0K8i', -- hash de 'demo123'
  'Administrador',
  'owner',
  true,
  false,
  NOW(),
  NOW()
);

-- =====================================================
-- Cómo ejecutar:
-- 1. Copia el bloque de CREATE TENANT y ejecuta
-- 2. Copia el ID retornado
-- 3. Reemplaza :tenant_id en el segundo bloque
-- 4. Ejecuta el INSERT de usuario
-- =====================================================

-- Verificar los datos creados
-- SELECT t.* FROM tenants t WHERE t.slug = 'demo';
-- SELECT u.* FROM users u WHERE u.email = 'admin@demo.com';

