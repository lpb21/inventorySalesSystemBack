# 🗄️ invLeo — Diagrama Entidad-Relación

Base de datos PostgreSQL · Arquitectura multi-tenant

```
mermaid
erDiagram
    TENANTS {
        uuid id PK
        string slug UK
        string name
        string business_name
        string email
        string address
        string phone
        string logo_url
        string plan
        string subscription_status
        string stripe_customer_id
        string stripe_subscription_id
        timestamp trial_ends_at
        timestamp created_at
        timestamp updated_at
    }

    USERS {
        uuid id PK
        uuid tenant_id FK
        string name
        string email UK
        string password_hash
        string role
        boolean active
        boolean is_superadmin
        timestamp last_login
        timestamp created_at
        timestamp updated_at
    }

    SUPPLIERS {
        uuid id PK
        uuid tenant_id FK
        string name
        string contact_name
        string phone
        string email
        string address
        string notes
        boolean active
        timestamp created_at
        timestamp updated_at
    }

    CATEGORIES {
        uuid id PK
        uuid tenant_id FK
        string name
        string description
        string icon
        boolean active
        timestamp created_at
        timestamp updated_at
    }

    PRODUCTS {
        uuid id PK
        uuid tenant_id FK
        uuid category_id FK
        uuid supplier_id FK
        string name
        string description
        string sku
        string barcode
        string unit
        string type
        decimal price
        decimal cost
        decimal stock
        decimal min_stock
        string image_url
        date expiry_date
        boolean active
        timestamp created_at
        timestamp updated_at
    }

    CUSTOMERS {
        uuid id PK
        uuid tenant_id FK
        string name
        string document
        string phone
        string email
        string address
        string notes
        timestamp created_at
        timestamp updated_at
    }

    CASH_REGISTERS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        string name
        decimal opening_amount
        decimal closing_amount
        decimal expected_amount
        decimal cash_in_drawer
        string status
        timestamp opened_at
        timestamp closed_at
        timestamp created_at
        timestamp updated_at
    }

    SALES {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        uuid customer_id FK
        uuid cash_register_id FK
        string ticket_number
        decimal subtotal
        decimal discount
        decimal tax
        decimal total
        string payment_method
        decimal amount_received
        decimal change_given
        string note
        string status
        timestamp created_at
        timestamp updated_at
    }

    SALE_ITEMS {
        uuid id PK
        uuid sale_id FK
        uuid tenant_id FK
        uuid product_id FK
        decimal quantity
        decimal unit_price
        decimal unit_cost
        decimal subtotal
        timestamp created_at
    }

    INVENTORY_MOVEMENTS {
        uuid id PK
        uuid tenant_id FK
        uuid product_id FK
        uuid user_id FK
        string type
        decimal quantity
        decimal stock_before
        decimal stock_after
        string reason
        string reference_id
        timestamp created_at
    }

    PURCHASE_ORDERS {
        uuid id PK
        uuid tenant_id FK
        uuid supplier_id FK
        uuid user_id FK
        string status
        string notes
        decimal subtotal
        decimal tax
        decimal total
        timestamp order_date
        timestamp expected_date
        timestamp received_date
        timestamp created_at
        timestamp updated_at
    }

    PURCHASE_ORDER_ITEMS {
        uuid id PK
        uuid purchase_order_id FK
        uuid product_id FK
        decimal quantity
        decimal unit_cost
        decimal quantity_received
        decimal subtotal
        timestamp created_at
    }

    TENANTS ||--o{ USERS : "tiene"
    TENANTS ||--o{ SUPPLIERS : "registra"
    TENANTS ||--o{ CATEGORIES : "define"
    TENANTS ||--o{ PRODUCTS : "maneja"
    TENANTS ||--o{ CUSTOMERS : "atiende"
    TENANTS ||--o{ CASH_REGISTERS : "opera"
    TENANTS ||--o{ SALES : "genera"
    TENANTS ||--o{ INVENTORY_MOVEMENTS : "audita"
    TENANTS ||--o{ PURCHASE_ORDERS : "ordena"
    CATEGORIES ||--o{ PRODUCTS : "clasifica"
    SUPPLIERS ||--o{ PRODUCTS : "suministra"
    SUPPLIERS ||--o{ PURCHASE_ORDERS : "abastece"
    USERS ||--o{ SALES : "realiza"
    USERS ||--o{ CASH_REGISTERS : "abre"
    USERS ||--o{ INVENTORY_MOVEMENTS : "ejecuta"
    USERS ||--o{ PURCHASE_ORDERS : "gestiona"
    CUSTOMERS ||--o{ SALES : "compra"
    CASH_REGISTERS ||--o{ SALES : "contiene"
    SALES ||--o{ SALE_ITEMS : "detalla"
    PRODUCTS ||--o{ SALE_ITEMS : "incluido_en"
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "registra"
    PRODUCTS ||--o{ PURCHASE_ORDER_ITEMS : "solicitado"
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : "contiene"
```

---

## Leyenda de relaciones

| Símbolo | Significado |
|---|---|
| `\|\|` | Exactamente uno |
| `o{` | Cero o muchos |
| `\|\|--o{` | Uno a muchos |

---

## Descripción de Tablas

### TENANTS (Empresas/Salsamentarías)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| slug | VARCHAR(100) | Identificador único para subdominios |
| name | VARCHAR(255) | Nombre del negocio |
| business_name | VARCHAR(255) | Razón social |
| email | VARCHAR(255) | Email de contacto |
| address | TEXT | Dirección |
| phone | VARCHAR(50) | Teléfono |
| logo_url | TEXT | URL del logo |
| plan | VARCHAR(50) | Plan actual (free, basic, pro, enterprise) |
| subscription_status | VARCHAR(50) | Estado de suscripción |
| stripe_customer_id | VARCHAR(255) | ID de cliente en Stripe |
| stripe_subscription_id | VARCHAR(255) | ID de suscripción en Stripe |
| trial_ends_at | TIMESTAMP | Fin del período de prueba |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### USERS (Usuarios)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| name | VARCHAR(255) | Nombre completo |
| email | VARCHAR(255) | Email único por tenant |
| password_hash | VARCHAR(255) | Contraseña hasheada |
| role | VARCHAR(50) | Rol (admin, cashier, viewer) |
| active | BOOLEAN | Estado de actividad |
| is_superadmin | BOOLEAN | Acceso total al sistema |
| last_login | TIMESTAMP | Último acceso |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### SUPPLIERS (Proveedores)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| name | VARCHAR(255) | Nombre del proveedor |
| contact_name | VARCHAR(255) | Nombre del contacto |
| phone | VARCHAR(50) | Teléfono |
| email | VARCHAR(255) | Email |
| address | TEXT | Dirección |
| notes | TEXT | Notas |
| active | BOOLEAN | Estado |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### CATEGORIES (Categorías)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| name | VARCHAR(100) | Nombre |
| description | TEXT | Descripción |
| icon | VARCHAR(50) | Icono |
| active | BOOLEAN | Estado |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### PRODUCTS (Productos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| category_id | UUID | Foreign Key -> CATEGORIES |
| supplier_id | UUID | Foreign Key -> SUPPLIERS |
| name | VARCHAR(255) | Nombre |
| description | TEXT | Descripción |
| sku | VARCHAR(50) | Código interno |
| barcode | VARCHAR(100) | Código de barras |
| unit | VARCHAR(20) | Unidad (kg, lb, und, paq) |
| type | VARCHAR(20) | Tipo (weight, unit, portion) |
| price | DECIMAL(12,2) | Precio de venta |
| cost | DECIMAL(12,2) | Costo |
| stock | DECIMAL(12,3) | Stock actual |
| min_stock | DECIMAL(12,3) | Stock mínimo |
| image_url | TEXT | URL de imagen |
| expiry_date | DATE | Fecha de vencimiento |
| active | BOOLEAN | Estado |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### CUSTOMERS (Clientes)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| name | VARCHAR(255) | Nombre |
| document | VARCHAR(50) | Documento de identidad |
| phone | VARCHAR(50) | Teléfono |
| email | VARCHAR(255) | Email |
| address | TEXT | Dirección |
| notes | TEXT | Notas |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### CASH_REGISTERS (Cajas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| user_id | UUID | Foreign Key -> USERS |
| name | VARCHAR(100) | Nombre de la caja |
| opening_amount | DECIMAL(12,2) | Monto de apertura |
| closing_amount | DECIMAL(12,2) | Monto de cierre |
| expected_amount | DECIMAL(12,2) | Monto esperado |
| cash_in_drawer | DECIMAL(12,2) | Efectivo en caja |
| status | VARCHAR(20) | Estado (open, closed) |
| opened_at | TIMESTAMP | Hora de apertura |
| closed_at | TIMESTAMP | Hora de cierre |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### SALES (Ventas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| user_id | UUID | Foreign Key -> USERS |
| customer_id | UUID | Foreign Key -> CUSTOMERS |
| cash_register_id | UUID | Foreign Key -> CASH_REGISTERS |
| ticket_number | VARCHAR(50) | Número de ticket |
| subtotal | DECIMAL(12,2) | Subtotal |
| discount | DECIMAL(12,2) | Descuento |
| tax | DECIMAL(12,2) | Impuesto |
| total | DECIMAL(12,2) | Total |
| payment_method | VARCHAR(50) | Método de pago |
| amount_received | DECIMAL(12,2) | Monto recibido |
| change_given | DECIMAL(12,2) | Cambio |
| note | TEXT | Notas |
| status | VARCHAR(20) | Estado (completed, cancelled, refunded) |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### SALE_ITEMS (Items de Venta)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| sale_id | UUID | Foreign Key -> SALES |
| tenant_id | UUID | Foreign Key -> TENANTS |
| product_id | UUID | Foreign Key -> PRODUCTS |
| quantity | DECIMAL(12,3) | Cantidad |
| unit_price | DECIMAL(12,2) | Precio unitario |
| unit_cost | DECIMAL(12,2) | Costo unitario |
| subtotal | DECIMAL(12,2) | Subtotal |
| created_at | TIMESTAMP | Fecha de creación |

### INVENTORY_MOVEMENTS (Movimientos de Inventario)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| product_id | UUID | Foreign Key -> PRODUCTS |
| user_id | UUID | Foreign Key -> USERS |
| type | VARCHAR(20) | Tipo (sale, purchase, adjustment, waste, return) |
| quantity | DECIMAL(12,3) | Cantidad |
| stock_before | DECIMAL(12,3) | Stock anterior |
| stock_after | DECIMAL(12,3) | Stock nuevo |
| reason | TEXT | Razón del movimiento |
| reference_id | UUID | Referencia relacionada |
| created_at | TIMESTAMP | Fecha de creación |

### PURCHASE_ORDERS (Órdenes de Compra)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key -> TENANTS |
| supplier_id | UUID | Foreign Key -> SUPPLIERS |
| user_id | UUID | Foreign Key -> USERS |
| status | VARCHAR(20) | Estado (pending, received, cancelled) |
| notes | TEXT | Notas |
| subtotal | DECIMAL(12,2) | Subtotal |
| tax | DECIMAL(12,2) | Impuesto |
| total | DECIMAL(12,2) | Total |
| order_date | TIMESTAMP | Fecha de orden |
| expected_date | TIMESTAMP | Fecha esperada |
| received_date | TIMESTAMP | Fecha de recepción |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### PURCHASE_ORDER_ITEMS (Items de Orden de Compra)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| purchase_order_id | UUID | Foreign Key -> PURCHASE_ORDERS |
| product_id | UUID | Foreign Key -> PRODUCTS |
| quantity | DECIMAL(12,3) | Cantidad ordenada |
| unit_cost | DECIMAL(12,2) | Costo unitario |
| quantity_received | DECIMAL(12,3) | Cantidad recibida |
| subtotal | DECIMAL(12,2) | Subtotal |
| created_at | TIMESTAMP | Fecha de creación |

---

## Roles de usuario (`role`)

| Valor | Permisos |
|-------|----------|
| owner | Acceso total, gestión de usuarios, configuración |
| admin | Gestión completa del negocio |
| supervisor | Gestión de productos, ventas, reportes |
| cashier | Solo POS y consulta de inventario |
| viewer | Solo lectura / reportes |

## Estados de suscripción (`subscription_status`)

| Valor | Descripción |
|-------|-------------|
| trial | Período de prueba gratuito |
| active | Suscripción activa y pagada |
| past_due | Pago fallido, acceso limitado |
| cancelled | Suscripción cancelada |
| suspended | Suspendido por inactividad |

## Tipos de movimientos de inventario (`type`)

| Valor | Descripción |
|-------|-------------|
| sale | Salida por venta |
| purchase | Entrada por compra |
| adjustment | Ajuste manual |
| waste | Merma / pérdida |
| return | Devolución |
| transfer | Transferencia entre almacenes |
