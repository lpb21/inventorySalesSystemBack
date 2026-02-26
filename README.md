# invLeo Backend - Sistema de Gestión de Inventarios para Salsamentarías (SaaS)

---

## 📋 Tabla de Contenidos

1. [Descripción del Proyecto](#descripción-del-proyecto)
2. [Tecnologías Utilizadas](#tecnologías-utilizadas)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Modelo de Datos](#modelo-de-datos)
5. [API Endpoints](#api-endpoints)
6. [Autenticación y Autorización](#autenticación-y-autorización)
7. [Configuración](#configuración)
8. [Instalación y Ejecución](#instalación-y-ejecución)
9. [Scripts Disponibles](#scripts-disponibles)
10. [Arquitectura Multi-tenant](#arquitectura-multi-tenant)
11. [Middleware de Seguridad](#middleware-de-seguridad)
12. [Contribución](#contribución)

---

## 📝 Descripción del Proyecto

**invLeo** es un sistema de gestión de inventarios SaaS multi-tenant diseñado específicamente para salsamentarías. Permite a múltiples negocios gestionar sus productos, ventas e inventarios de forma aislada y segura.

### Características Principales

- ✅ **Gestión de Productos**: CRUD completo, búsqueda por código de barras, SKU
- ✅ **Control de Inventario**: Movimientos de entrada/salida, ajustes de stock
- ✅ **Sistema de Ventas (POS)**: Registro de ventas, cancelación, reportes
- ✅ **Gestión de Usuarios**: Roles y permisos (owner, admin, supervisor, cashier)
- ✅ **Categorías y Clientes**: Organización completa del negocio
- ✅ **Reportes**: Dashboard, ventas, inventario, ganancias
- ✅ **Arquitectura Multi-tenant**: Aislamiento completo de datos por empresa

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Propósito |
|------------|-----------|
| **Node.js** | Entorno de ejecución JavaScript |
| **Express.js** | Framework web para APIs REST |
| **Sequelize** | ORM para PostgreSQL |
| **PostgreSQL** | Base de datos relacional |
| **JWT** | Autenticación con JSON Web Tokens |
| **bcryptjs** | Hash de contraseñas |
| **Joi** | Validación de datos |
| **Helmet** | Headers de seguridad |
| **CORS** | Configuración de Cross-Origin |
| **Morgan** | Logging de requests |

---

## 📁 Estructura del Proyecto

```
sisInventariosBACK/
├── src/
│   ├── config/
│   │   ├── database.js       # Configuración de Sequelize
│   │   ├── env.js           # Variables de entorno
│   │   └── seed.js          # Datos iniciales de prueba
│   │
│   ├── controllers/
│   │   ├── authController.js    # Autenticación
│   │   ├── categoryController.js
│   │   ├── customerController.js
│   │   ├── inventoryController.js
│   │   ├── productController.js
│   │   ├── reportController.js
│   │   ├── saleController.js
│   │   ├── tenantController.js
│   │   └── userController.js
│   │
│   ├── middlewares/
│   │   ├── authMiddleware.js       # Validación JWT
│   │   ├── errorMiddleware.js      # Manejo de errores
│   │   ├── permissionMiddleware.js # Roles y permisos
│   │   ├── tenantMiddleware.js     # Aislamiento multi-tenant
│   │   └── validationMiddleware.js # Validación de datos
│   │
│   ├── models/
│   │   ├── index.js           # Modelos Sequelize
│   │   ├── Tenant.js          # Empresas
│   │   ├── User.js            # Usuarios
│   │   ├── Category.js        # Categorías
│   │   ├── Product.js         # Productos
│   │   ├── Customer.js        # Clientes
│   │   ├── Supplier.js        # Proveedores
│   │   ├── InventoryMovement.js
│   │   ├── Sale.js            # Ventas
│   │   ├── SaleItem.js        # Ítems de venta
│   │   ├── CashRegister.js    # Caja
│   │   ├── PurchaseOrder.js   # Órdenes de compra
│   │   └── PurchaseOrderItem.js
│   │
│   ├── routes/
│   │   ├── index.js           # Router principal
│   │   └── v1/
│   │       ├── authRoutes.js
│   │       ├── categoryRoutes.js
│   │       ├── customerRoutes.js
│   │       ├── inventoryRoutes.js
│   │       ├── productRoutes.js
│   │       ├── reportRoutes.js
│   │       ├── saleRoutes.js
│   │       ├── settingsRoutes.js
│   │       ├── supplierRoutes.js
│   │       ├── tenantRoutes.js
│   │       └── userRoutes.js
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── categoryService.js
│   │   ├── inventoryService.js
│   │   ├── productService.js
│   │   └── saleService.js
│   │
│   ├── utils/
│   │   ├── errors.js         # Clases de errores personalizados
│   │   ├── helpers.js         # Utilidades varias
│   │   └── validators.js      # Esquemas de validación Joi
│   │
│   ├── app.js                # Configuración de Express
│   └── server.js             # Punto de entrada
│
├── .env                      # Variables de entorno
├── .env.example              # Ejemplo de variables
├── package.json
├── README.md
└── TODO.md
```

---

## 🗄️ Modelo de Datos

### Tablas Principales

#### tenants (Empresas/Salsamentarías)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| name | VARCHAR(255) | Nombre de la empresa |
| slug | VARCHAR(100) | Identificador único |
| business_name | VARCHAR(255) | Razón social |
| address | TEXT | Dirección |
| phone | VARCHAR(50) | Teléfono |
| email | VARCHAR(255) | Email de contacto |
| plan | VARCHAR(50) | Plan (free, basic, pro, enterprise) |
| subscription_status | VARCHAR(50) | Estado de suscripción |
| is_active | BOOLEAN | ¿Empresa activa? |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

#### users (Usuarios)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key → tenants |
| name | VARCHAR(255) | Nombre completo |
| email | VARCHAR(255) | Email único por tenant |
| password_hash | VARCHAR(255) | Contraseña hasheada |
| role | VARCHAR(50) | Rol (owner, admin, supervisor, cashier) |
| is_active | BOOLEAN | ¿Usuario activo? |
| is_superadmin | BOOLEAN | ¿Superadmin? |
| last_login | TIMESTAMP | Último login |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

#### categories (Categorías)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key → tenants |
| name | VARCHAR(100) | Nombre de categoría |
| description | TEXT | Descripción |
| icon | VARCHAR(50) | Icono |
| is_active | BOOLEAN | ¿Activa? |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

#### products (Productos)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key → tenants |
| category_id | UUID | Foreign Key → categories |
| supplier_id | UUID | Foreign Key → suppliers |
| name | VARCHAR(255) | Nombre del producto |
| description | TEXT | Descripción |
| sku | VARCHAR(50) | Código interno |
| barcode | VARCHAR(100) | Código de barras |
| price | DECIMAL(12,2) | Precio de venta |
| cost | DECIMAL(12,2) | Costo |
| stock | DECIMAL(12,3) | Stock actual |
| min_stock | DECIMAL(12,3) | Stock mínimo |
| unit | VARCHAR(20) | Unidad (kg, lb, und, paq) |
| type | VARCHAR(20) | Tipo (weight, unit, portion) |
| image_url | TEXT | URL de imagen |
| expiry_date | DATE | Fecha de vencimiento |
| is_active | BOOLEAN | ¿Activo? |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

#### inventory_movements (Movimientos de Inventario)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key → tenants |
| product_id | UUID | Foreign Key → products |
| user_id | UUID | Foreign Key → users |
| type | VARCHAR(20) | Tipo (in, out, adjustment, sale) |
| quantity | DECIMAL(12,3) | Cantidad |
| stock_before | DECIMAL(12,3) | Stock anterior |
| stock_after | DECIMAL(12,3) | Stock nuevo |
| reason | TEXT | Razón del movimiento |
| reference_id | UUID | Referencia (venta, ajuste) |
| created_at | TIMESTAMP | Fecha de creación |

#### sales (Ventas)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| tenant_id | UUID | Foreign Key → tenants |
| user_id | UUID | Foreign Key → users |
| customer_id | UUID | Foreign Key → customers |
| cash_register_id | UUID | Foreign Key → cash_registers |
| ticket_number | VARCHAR(50) | Número de ticket |
| subtotal | DECIMAL(12,2) | Subtotal |
| discount | DECIMAL(12,2) | Descuento |
| tax | DECIMAL(12,2) | Impuesto |
| total | DECIMAL(12,2) | Total |
| payment_method | VARCHAR(50) | Método de pago |
| amount_received | DECIMAL(12,2) | Monto recibido |
| change_given | DECIMAL(12,2) | Cambio |
| status | VARCHAR(20) | Estado (completed, cancelled, refunded) |
| note | TEXT | Notas |
| customer_name | VARCHAR(255) | Nombre del cliente |
| customer_document | VARCHAR(50) | Documento del cliente |
| cancelled_at | TIMESTAMP | Fecha de cancelación |
| cancelled_reason | TEXT | Razón de cancelación |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

#### sale_items (Ítems de Venta)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary Key |
| sale_id | UUID | Foreign Key → sales |
| tenant_id | UUID | Foreign Key → tenants |
| product_id | UUID | Foreign Key → products |
| quantity | DECIMAL(12,3) | Cantidad |
| unit_price | DECIMAL(12,2) | Precio unitario |
| unit_cost | DECIMAL(12,2) | Costo unitario |
| subtotal | DECIMAL(12,2) | Subtotal |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

---

## 🔌 API Endpoints

### Prefijo: `/v1`

Todas las rutas requieren autenticación excepto las de auth.

---

### 📝 Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/v1/auth/login` | Iniciar sesión |
| POST | `/v1/auth/register` | Registrar nueva empresa |
| POST | `/v1/auth/forgot-password` | Recuperar contraseña |
| POST | `/v1/auth/reset-password` | Restablecer contraseña |
| GET | `/v1/auth/me` | Obtener usuario actual |
| POST | `/v1/auth/refresh-token` | Renovar token |
| POST | `/v1/auth/logout` | Cerrar sesión |

---

### 📦 Productos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/products` | Listar productos (paginado) |
| GET | `/v1/products/:id` | Obtener producto por ID |
| POST | `/v1/products` | Crear producto |
| PUT | `/v1/products/:id` | Actualizar producto |
| DELETE | `/v1/products/:id` | Eliminar producto (soft delete) |
| GET | `/v1/products/low-stock` | Productos con stock bajo |
| GET | `/v1/products/barcode/:code` | Buscar por código de barras |
| GET | `/v1/products/search` | Búsqueda avanzada |

**Query Parameters para GET /products:**
- `page` - Página actual (default: 1)
- `limit` - Items por página (default: 20)
- `search` - Término de búsqueda
- `category_id` - Filtrar por categoría
- `is_active` - Filtrar por estado

---

### 📂 Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/categories` | Listar categorías |
| GET | `/v1/categories/:id` | Obtener categoría por ID |
| POST | `/v1/categories` | Crear categoría |
| PUT | `/v1/categories/:id` | Actualizar categoría |
| DELETE | `/v1/categories/:id` | Eliminar categoría |

---

### 📊 Inventario

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/inventory` | Ver inventario actual |
| POST | `/v1/inventory/adjust` | Ajustar inventario |
| GET | `/v1/inventory/movements` | Historial de movimientos |
| GET | `/v1/inventory/movements/:productId` | Movimientos de un producto |
| POST | `/v1/inventory/bulk-adjust` | Ajuste masivo |

---

### 💰 Ventas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/sales` | Listar ventas |
| GET | `/v1/sales/:id` | Obtener venta por ID |
| POST | `/v1/sales` | Crear nueva venta |
| POST | `/v1/sales/:id/cancel` | Cancelar venta |
| POST | `/v1/sales/:id/refund` | Realizar devolución |
| GET | `/v1/sales/today` | Ventas de hoy |
| GET | `/v1/sales/by-date` | Ventas por rango de fecha |

---

### 👥 Usuarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/users` | Listar usuarios |
| GET | `/v1/users/:id` | Obtener usuario por ID |
| POST | `/v1/users` | Crear usuario |
| PUT | `/v1/users/:id` | Actualizar usuario |
| DELETE | `/v1/users/:id` | Eliminar usuario |
| PUT | `/v1/users/:id/reset-password` | Restablecer contraseña |
| PUT | `/v1/users/:id/toggle-status` | Activar/desactivar usuario |

---

### 📈 Reportes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/reports/dashboard` | Datos para dashboard |
| GET | `/v1/reports/sales` | Reporte de ventas |
| GET | `/v1/reports/inventory` | Reporte de inventario |
| GET | `/v1/reports/profits` | Reporte de ganancias |
| GET | `/v1/reports/top-products` | Productos más vendidos |
| GET | `/v1/reports/low-stock` | Productos con stock bajo |

---

### 🏢 Empresas (Tenants)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/tenants/current` | Obtener empresa actual |
| PUT | `/v1/tenants/current` | Actualizar empresa |
| GET | `/v1/tenants/current/subscription` | Ver suscripción |

---

### ⚙️ Configuración

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/settings` | Obtener configuración |
| PUT | `/v1/settings` | Actualizar configuración |
| GET | `/v1/settings/business` | Datos del negocio |
| PUT | `/v1/settings/business` | Actualizar datos del negocio |

---

### 👤 Clientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/customers` | Listar clientes |
| GET | `/v1/customers/:id` | Obtener cliente por ID |
| POST | `/v1/customers` | Crear cliente |
| PUT | `/v1/customers/:id` | Actualizar cliente |
| DELETE | `/v1/customers/:id` | Eliminar cliente |

---

### 🚚 Proveedores

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/suppliers` | Listar proveedores |
| GET | `/v1/suppliers/:id` | Obtener proveedor por ID |
| POST | `/v1/suppliers` | Crear proveedor |
| PUT | `/v1/suppliers/:id` | Actualizar proveedor |
| DELETE | `/v1/suppliers/:id` | Eliminar proveedor |

---

## 🔐 Autenticación y Autorización

### Estructura del JWT Token

```
json
{
  "userId": "uuid-del-usuario",
  "tenantId": "uuid-de-la-empresa",
  "role": "admin",
  "email": "admin@mi-salsamentaria.com",
  "exp": 1715000000,
  "iat": 1714395200
}
```

### Roles y Permisos

| Rol | Descripción |
|-----|-------------|
| **owner** | Acceso total, gestión de usuarios, configuración, reportes completos |
| **admin** | Gestión de productos, categorías, ventas, reportes |
| **supervisor** | Gestión de productos, ventas, reportes (sin ver costos) |
| **cashier** | Solo ventas, vista de solo lectura en inventario |

### Headers Requeridos

```
http
Authorization: Bearer <token_jwt>
```

---

## ⚙️ Configuración

### Variables de Entorno (.env)

```
env
# Entorno
NODE_ENV=development
PORT=3000

# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invleo_db
DB_USER=postgres
DB_PASSWORD=tu_contraseña

# JWT
JWT_SECRET=tu-secret-key-muy-segura
JWT_EXPIRES_IN=7d

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:5173

# Redis (opcional - para caché)
# REDIS_URL=redis://localhost:6379
```

---

## 🚀 Instalación y Ejecución

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Pasos de Instalación

1. **Clonar el repositorio**
   
```
bash
   git clone <repo-url>
   cd sisInventariosBACK
   
```

2. **Instalar dependencias**
   
```
bash
   npm install
   
```

3. **Configurar variables de entorno**
   
```
bash
   cp .env.example .env
   # Editar .env con tus credenciales
   
```

4. **Crear la base de datos**
   
```
bash
   # Conectarse a PostgreSQL
   psql -U postgres
   CREATE DATABASE invleo_db;
   
```

5. **Ejecutar el servidor**
   
```bash
   # Modo desarrollo (con auto-reload)
   npm run dev
   
   # O modo producción
   npm start
   
```

6. **(Opcional) Poblar con datos de prueba**
   
```
bash
   npm run db:seed
   
```

---

## 📜 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Iniciar servidor en producción |
| `npm run dev` | Iniciar servidor en desarrollo con auto-reload |
| `npm run db:sync` | Sincronizar modelos con la base de datos |
| `npm run db:seed` | Poblar base de datos con datos de prueba |

---

## 🏗️ Arquitectura Multi-tenant

### Aislamiento de Datos

El sistema implementa aislamiento a nivel de aplicación:

1. **Middleware de Tenant**: Cada request incluye el `tenantId` del JWT
2. **Consultas con Filtro**: Todas las consultas incluyen `WHERE tenant_id = ?`
3. **Validación de Acceso**: El usuario solo puede acceder a datos de su empresa

### Flujo de una Solicitud

```
Request → JWT Validation → Tenant Middleware → Controller → Service → Database
                ↓
         ¿Token válido?
                ↓
         ¿Usuario activo?
                ↓
         Establecer tenantId en request
```

---

## 🛡️ Middleware de Seguridad

### 1. authMiddleware.js
Valida el JWT token y adjunta el usuario al request.

### 2. tenantMiddleware.js
Establece el contexto del tenant para todas las consultas.

### 3. permissionMiddleware.js
Verifica que el usuario tenga el rol necesario para la acción.

### 4. validationMiddleware.js
Valida los datos de entrada usando Joi.

### 5. errorMiddleware.js
Manejo centralizado de errores y respuestas consistentes.

---

## 📊 Ejemplos de Uso

### Iniciar Sesión

```
bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mi-salsamentaria.com", "password": "admin123"}'
```

### Respuesta Exitosa

```
json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1...",
    "user": {
      "id": "uuid",
      "email": "admin@mi-salsamentaria.com",
      "name": "Administrador",
      "role": "owner"
    }
  }
}
```

### Listar Productos (con Auth)

```
bash
curl -X GET http://localhost:3000/v1/products \
  -H "Authorization: Bearer <token_jwt>"
```

---

## 📈 Planes y Limitaciones

| Plan | Productos | Usuarios | Funcionalidades |
|------|-----------|----------|-----------------|
| Free | 100 | 1 | Básico |
| Basic | 500 | 3 | Inventario + Ventas |
| Pro | 2000 | 10 | Completo + Reportes |
| Enterprise | Ilimitado | Ilimitado | Todo + API + Soporte |

---

## 🤝 Contribución

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit de cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

---

## 📄 Licencia

ISC License - LeonardoParra

---

## 👨‍💻 Autor

LeonardoParra - [GitHub](https://github.com/LeonardoParra)

---

*Documentación generada para invLeo Backend v1.0.0*
