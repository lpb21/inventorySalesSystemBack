# 🗄️ invLeo — Validación del Backend & Setup de Base de Datos PostgreSQL

> **Proyecto:** Sistema de Gestión de Inventarios para Salsamentarías (SaaS Multi-Tenant)
> **Autor:** LeonardoParra
> **Stack:** Node.js · Express · Sequelize ORM · PostgreSQL

---

## ✅ Validación de la Arquitectura del Backend

### 🏗️ Estructura General

El backend está bien construido siguiendo una arquitectura **en capas (Layered Architecture)** clara y escalable:

```
src/
├── app.js              # Configuración de Express y middlewares globales
├── server.js           # Punto de entrada, conexión DB y arranque del servidor
├── config/
│   ├── database.js     # Configuración de Sequelize/PostgreSQL
│   └── env.js          # Variables de entorno centralizadas
├── models/             # Modelos Sequelize (12 entidades + index.js con asociaciones)
├── controllers/        # Lógica de respuesta HTTP (8 controladores)
├── services/           # Lógica de negocio desacoplada (5 servicios)
├── routes/
│   ├── index.js        # Router principal
│   └── v1/             # 11 grupos de rutas versionadas
├── middlewares/        # 5 middlewares especializados
└── utils/              # Utilidades compartidas
```

### 🟢 Fortalezas identificadas

| Aspecto                        | Evaluación                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Separación de capas** | ✅ Controllers → Services → Models correctamente separados                                     |
| **Versionado de API**    | ✅ Prefijo `/v1` en todas las rutas                                                            |
| **Multi-tenant**         | ✅ Todas las entidades tienen `tenant_id` como FK a `tenants`                                |
| **Autenticación**       | ✅ JWT con Bearer Token vía `authMiddleware.js`                                               |
| **Autorización**        | ✅ Sistema RBAC completo con jerarquía de roles (owner > admin > supervisor > cashier > viewer) |
| **Seguridad**            | ✅ Helmet, CORS configurado, body-size limitado                                                  |
| **Validación**          | ✅ Joi para validación de entrada vía `validationMiddleware.js`                              |
| **Logging**              | ✅ Morgan en modo `dev` o `combined` según entorno                                          |
| **Manejo de errores**    | ✅ Middleware centralizado `errorMiddleware.js`                                                |
| **ORM**                  | ✅ Sequelize 6 con modelos tipados y asociaciones declaradas                                     |
| **Base de datos**        | ✅ PostgreSQL con UUIDs como PKs                                                                 |
| **Variables de entorno** | ✅ dotenv centralizado en `config/env.js`                                                      |
| **Scripts npm**          | ✅`db:sync` y `db:seed` para gestión de base de datos                                       |

### 🟡 Observaciones y Recomendaciones

| Área                         | Observación                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| **Rate Limiting**       | No se detectó `express-rate-limit`. Recomendado para proteger endpoints de auth       |
| **Refresh Tokens**      | Solo se ve JWT simple. Para SaaS se recomienda implementar refresh tokens                |
| **Redis/Caché**        | El `env.js` tiene `redisUrl` pero parece no estar implementado aún                  |
| **Paginación**         | Verificar que todos los listados tengan paginación en los services                      |
| **Soft delete**         | Los modelos tienen campo `active` pero validar si usan `paranoid: true` en Sequelize |
| **Logs de producción** | Considerar Winston o Pino para logs estructurados en producción                         |

### 📋 Roles y Permisos (RBAC)

```
owner       → Acceso total (todos los módulos)
admin       → Gestión completa del negocio
supervisor  → Productos, ventas, inventario, reportes
cashier     → POS + consulta de inventario
viewer      → Solo lectura / reportes
```

---

## 📊 Script SQL — Creación de Base de Datos PostgreSQL

> Copia y ejecuta este script completo en tu cliente PostgreSQL (psql, pgAdmin, DBeaver, etc.)

```
-- =============================================================
-- invLeo — Script de creación de base de datos
-- Sistema de Gestión de Inventarios para Salsamentarías (SaaS)
-- PostgreSQL · Multi-Tenant Architecture
-- =============================================================

-- 1. CREAR BASE DE DATOS
-- (Ejecutar conectado a 'postgres' u otra base de datos distinta)
-- DROP DATABASE IF EXISTS invleo_db;
CREATE DATABASE invleo_db
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'es_CO.UTF-8'
    LC_CTYPE = 'es_CO.UTF-8'
    TEMPLATE = template0;

-- Conectarse a la base de datos recién creada antes de continuar:
-- \c invleo_db

-- =============================================================
-- EXTENSIONES
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- Para gen_random_uuid() / uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Para crypt() si se hashea en DB (opcional)

-- =============================================================
-- TABLA: tenants (Empresas / Salsamentarías)
-- =============================================================
CREATE TABLE IF NOT EXISTS tenants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    VARCHAR(100) NOT NULL UNIQUE,
    name                    VARCHAR(255) NOT NULL,
    business_name           VARCHAR(255),
    email                   VARCHAR(255) NOT NULL,
    address                 TEXT,
    phone                   VARCHAR(50),
    logo_url                TEXT,
    plan                    VARCHAR(50) NOT NULL DEFAULT 'free'
                                CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
    subscription_status     VARCHAR(50) NOT NULL DEFAULT 'trial'
                                CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'suspended')),
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    trial_ends_at           TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'Empresas/Salsamentarías registradas en el SaaS';

-- =============================================================
-- TABLA: users (Usuarios del sistema)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'cashier'
                        CHECK (role IN ('owner', 'admin', 'supervisor', 'cashier', 'viewer')),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    is_superadmin   BOOLEAN NOT NULL DEFAULT FALSE,
    last_login      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Email único por tenant (no global)
    UNIQUE (tenant_id, email)
);

COMMENT ON TABLE users IS 'Usuarios del sistema con roles RBAC por tenant';
COMMENT ON COLUMN users.role IS 'owner | admin | supervisor | cashier | viewer';

-- =============================================================
-- TABLA: categories (Categorías de productos)
-- =============================================================
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    icon        VARCHAR(50),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE categories IS 'Categorías de productos por tenant';

-- =============================================================
-- TABLA: suppliers (Proveedores)
-- =============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    contact_name    VARCHAR(255),
    phone           VARCHAR(50),
    email           VARCHAR(255),
    address         TEXT,
    notes           TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE suppliers IS 'Proveedores de productos por tenant';

-- =============================================================
-- TABLA: products (Productos / Inventario)
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    sku             VARCHAR(50),
    barcode         VARCHAR(100),
    unit            VARCHAR(20) NOT NULL DEFAULT 'und'
                        CHECK (unit IN ('kg', 'lb', 'und', 'paq', 'lt', 'gr')),
    type            VARCHAR(20) NOT NULL DEFAULT 'unit'
                        CHECK (type IN ('weight', 'unit', 'portion')),
    price           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    cost            DECIMAL(12, 2) NOT NULL DEFAULT 0,
    stock           DECIMAL(12, 3) NOT NULL DEFAULT 0,
    min_stock       DECIMAL(12, 3) NOT NULL DEFAULT 0,
    image_url       TEXT,
    expiry_date     DATE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sku)
);

COMMENT ON TABLE products IS 'Catálogo de productos/inventario por tenant';
COMMENT ON COLUMN products.type IS 'weight (se vende por peso) | unit (por unidad) | portion (por porción)';

-- =============================================================
-- TABLA: customers (Clientes)
-- =============================================================
CREATE TABLE IF NOT EXISTS customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    document    VARCHAR(50),
    phone       VARCHAR(50),
    email       VARCHAR(255),
    address     TEXT,
    notes       TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE customers IS 'Clientes por tenant';

-- =============================================================
-- TABLA: cash_registers (Cajas registradoras)
-- =============================================================
CREATE TABLE IF NOT EXISTS cash_registers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    opening_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0,
    closing_amount  DECIMAL(12, 2),
    expected_amount DECIMAL(12, 2),
    cash_in_drawer  DECIMAL(12, 2),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),
    opened_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cash_registers IS 'Sesiones de caja registradora por tenant';

-- =============================================================
-- TABLA: sales (Ventas / Tickets POS)
-- =============================================================
CREATE TABLE IF NOT EXISTS sales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    cash_register_id    UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
    ticket_number       VARCHAR(50) NOT NULL,
    subtotal            DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount            DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax                 DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total               DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_method      VARCHAR(50) NOT NULL DEFAULT 'cash'
                            CHECK (payment_method IN ('cash', 'card', 'transfer', 'mixed')),
    amount_received     DECIMAL(12, 2) NOT NULL DEFAULT 0,
    change_given        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    note                TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'completed'
                            CHECK (status IN ('completed', 'cancelled', 'refunded')),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, ticket_number)
);

COMMENT ON TABLE sales IS 'Transacciones de venta (tickets POS) por tenant';

-- =============================================================
-- TABLA: sale_items (Líneas/Ítems de venta)
-- =============================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    DECIMAL(12, 3) NOT NULL,
    unit_price  DECIMAL(12, 2) NOT NULL,
    unit_cost   DECIMAL(12, 2) NOT NULL DEFAULT 0,
    subtotal    DECIMAL(12, 2) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sale_items IS 'Líneas de detalle de cada venta';

-- =============================================================
-- TABLA: inventory_movements (Movimientos de inventario)
-- =============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type            VARCHAR(20) NOT NULL
                        CHECK (type IN ('sale', 'purchase', 'adjustment', 'waste', 'return', 'transfer')),
    quantity        DECIMAL(12, 3) NOT NULL,
    stock_before    DECIMAL(12, 3) NOT NULL,
    stock_after     DECIMAL(12, 3) NOT NULL,
    reason          TEXT,
    reference_id    UUID,   -- ID de la venta, orden de compra u otro documento relacionado
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE inventory_movements IS 'Auditoría de todos los movimientos de inventario';
COMMENT ON COLUMN inventory_movements.type IS 'sale | purchase | adjustment | waste | return | transfer';

-- =============================================================
-- TABLA: purchase_orders (Órdenes de compra)
-- =============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'received', 'cancelled', 'partial')),
    notes           TEXT,
    subtotal        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax             DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    order_date      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expected_date   TIMESTAMP WITH TIME ZONE,
    received_date   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchase_orders IS 'Órdenes de compra a proveedores por tenant';

-- =============================================================
-- TABLA: purchase_order_items (Ítems de órdenes de compra)
-- =============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity            DECIMAL(12, 3) NOT NULL,
    unit_cost           DECIMAL(12, 2) NOT NULL,
    quantity_received   DECIMAL(12, 3) NOT NULL DEFAULT 0,
    subtotal            DECIMAL(12, 2) NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchase_order_items IS 'Líneas de detalle de cada orden de compra';

-- =============================================================
-- ÍNDICES DE RENDIMIENTO
-- =============================================================

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(subscription_status);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date) WHERE expiry_date IS NOT NULL;

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

-- Cash Registers
CREATE INDEX IF NOT EXISTS idx_cash_registers_tenant ON cash_registers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(tenant_id, status);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_ticket ON sales(tenant_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(tenant_id, status);

-- Sale Items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id);

-- Inventory Movements
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant ON inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_user ON inventory_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(tenant_id, created_at);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(tenant_id, status);

-- Purchase Order Items
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);

-- =============================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER set_updated_at_tenants
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_categories
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_suppliers
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_products
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_customers
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_cash_registers
    BEFORE UPDATE ON cash_registers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_sales
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_purchase_orders
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- DATOS SEMILLA (SEED) — Tenant demo y usuario superadmin
-- =============================================================

-- Tenant demo
INSERT INTO tenants (
    slug, name, business_name, email, plan, subscription_status, trial_ends_at
) VALUES (
    'demo-salsamentaria',
    'Salsamentaría El Buen Sabor',
    'Comercializadora El Buen Sabor S.A.S',
    'admin@buensabor.com',
    'pro',
    'trial',
    NOW() + INTERVAL '30 days'
) ON CONFLICT (slug) DO NOTHING;

-- Usuario superadmin del tenant demo
-- Contraseña: Admin123! (hasheada con bcrypt rounds=10)
INSERT INTO users (
    tenant_id, name, email, password_hash, role, active, is_superadmin
) VALUES (
    (SELECT id FROM tenants WHERE slug = 'demo-salsamentaria'),
    'Administrador Demo',
    'admin@buensabor.com',
    '$2b$10$rOzJqx0IWqFRUeNlBrS.5.Nt.PQFBjUJrKLv7vMxT1Aqw0zF9ZXZK',  -- reemplazar con hash real
    'owner',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Categorías iniciales para el tenant demo
INSERT INTO categories (tenant_id, name, description, icon) VALUES
    ((SELECT id FROM tenants WHERE slug = 'demo-salsamentaria'), 'Embutidos', 'Salchichas, chorizos, mortadela', '🌭'),
    ((SELECT id FROM tenants WHERE slug = 'demo-salsamentaria'), 'Quesos', 'Quesos frescos y maduros', '🧀'),
    ((SELECT id FROM tenants WHERE slug = 'demo-salsamentaria'), 'Jamones', 'Jamón cocido, serrano y especiales', '🥩'),
    ((SELECT id FROM tenants WHERE slug = 'demo-salsamentaria'), 'Bebidas', 'Refrescos, jugos y agua', '🥤'),
    ((SELECT id FROM tenants WHERE slug = 'demo-salsamentaria'), 'Lácteos', 'Leche, mantequilla, crema de leche', '🥛')
ON CONFLICT DO NOTHING;

-- =============================================================
-- VERIFICACIÓN FINAL
-- =============================================================
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## 🚀 Cómo ejecutar el script

### Opción A — psql CLI

```bash
# Conectarse a PostgreSQL como superusuario
psql -U postgres

# Dentro de psql, ejecutar el script
\i /ruta/al/SETUP_DATABASE.md

# O ejecutar directamente desde terminal
psql -U postgres -f SETUP_DATABASE.sql
```

### Opción B — pgAdmin

1. Abrir **pgAdmin 4**
2. Click derecho en **Databases** → **Create** → **Database** → Nombre: `invleo_db`
3. Abrir **Query Tool** en la base de datos creada
4. Copiar y pegar el bloque `SQL` de arriba
5. Ejecutar con `F5`

### Opción C — Sequelize ORM (recomendado para desarrollo)

```bash
# Desde la raíz del proyecto
npm run db:sync    # Crea/actualiza tablas via Sequelize
npm run db:seed    # Inserta datos iniciales
```

---

## 🔗 Relaciones entre tablas

```
tenants ──< users
tenants ──< categories
tenants ──< suppliers
tenants ──< products >── categories
                     └── suppliers
tenants ──< customers
tenants ──< cash_registers >── users
tenants ──< sales >── users
               └── customers
               └── cash_registers
               └──< sale_items >── products
tenants ──< inventory_movements >── products
                                └── users
tenants ──< purchase_orders >── suppliers
                            └── users
                            └──< purchase_order_items >── products
```

---

*Generado para el proyecto **invLeo** · `sisInventariosBACK` · Febrero 2026*
