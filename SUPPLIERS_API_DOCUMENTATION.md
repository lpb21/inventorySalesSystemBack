# Documentación de Endpoints - Gestión de Proveedores (Suppliers)

## Visión General

Los proveedores son entidades que suministran productos a tu inventario. Cada producto puede estar asociado a un proveedor específico, lo que permite un mejor control y seguimiento de la procedencia de los productos.

## Endpoints Disponibles

### 1. Listar Proveedores

**GET** `/v1/suppliers`

Lista todos los proveedores con paginación y filtros.

**Parámetros de consulta:**
- `page` (opcional): Número de página (por defecto: 1)
- `limit` (opcional): Elementos por página (por defecto: 10)
- `search` (opcional): Buscar por nombre, contacto, teléfono, email o documento
- `is_active` (opcional): Filtrar por estado activo (true/false)

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Samsung Electronics",
        "contact_name": "Juan Pérez",
        "document": "20123456789",
        "email": "contacto@samsung.com",
        "phone": "+51-999-888-777",
        "address": "Av. Principal 123, Lima",
        "notes": "Proveedor principal de tecnología",
        "is_active": true,
        "product_count": 5,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

---

### 2. Proveedores Para Select/Dropdown

**GET** `/v1/suppliers/select`

Obtiene una lista simplificada de proveedores activos para usar en selecciones.

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Samsung Electronics",
      "display_name": "Samsung Electronics (20123456789)",
      "contact_name": "Juan Pérez"
    }
  ]
}
```

---

### 3. Crear Proveedor

**POST** `/v1/suppliers`

Crea un nuevo proveedor.

**Cuerpo de la solicitud:**
```json
{
  "name": "Samsung Electronics",
  "contact_name": "Juan Pérez",
  "document": "20123456789",
  "email": "contacto@samsung.com",
  "phone": "+51-999-888-777",
  "address": "Av. Principal 123, Lima",
  "notes": "Proveedor principal de tecnología"
}
```

**Campos requeridos:**
- `name`: Nombre del proveedor (máx. 255 caracteres)

**Campos opcionales:**
- `contact_name`: Nombre del contacto (máx. 255 caracteres)
- `document`: Documento/RUC/NIT del proveedor (máx. 50 caracteres)
- `email`: Email del proveedor (debe ser formato válido)
- `phone`: Teléfono (máx. 50 caracteres)
- `address`: Dirección (máx. 1000 caracteres)
- `notes`: Notas adicionales (máx. 1000 caracteres)
- `is_active`: Estado activo (por defecto: true)

---

### 4. Obtener Proveedor por ID

**GET** `/v1/suppliers/:id`

Obtiene los detalles de un proveedor específico, incluyendo sus productos asociados.

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Samsung Electronics",
    "contact_name": "Juan Pérez",
    "document": "20123456789",
    "email": "contacto@samsung.com",
    "phone": "+51-999-888-777",
    "address": "Av. Principal 123, Lima",
    "notes": "Proveedor principal de tecnología",
    "is_active": true,
    "product_count": 5,
    "products": [
      {
        "id": "456e7890-e89b-12d3-a456-426614174000",
        "name": "Monitor Samsung 24 pulgadas",
        "sku": "MON-SAM-24",
        "price": 299.99,
        "stock": 15
      }
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 5. Actualizar Proveedor

**PUT** `/v1/suppliers/:id`

Actualiza un proveedor existente.

**Cuerpo de la solicitud:** (todos los campos son opcionales)
```json
{
  "name": "Samsung Electronics S.A.",
  "contact_name": "María García",
  "email": "nuevo-contacto@samsung.com",
  "is_active": false
}
```

---

### 6. Eliminar Proveedor

**DELETE** `/v1/suppliers/:id`

Elimina un proveedor (soft delete). 

**Restricciones:**
- No se puede eliminar un proveedor que tenga productos asociados
- El proveedor se marca como `is_active: false`

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "message": "Proveedor eliminado exitosamente"
  }
}
```

---

## Integración con Productos

### Crear Producto con Proveedor

Cuando crear un producto, ahora puedes incluir el `supplier_id`:

```json
{
  "name": "Monitor Samsung 24 pulgadas",
  "category_id": "789e0123-e89b-12d3-a456-426614174000",
  "supplier_id": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Monitor LED 24 pulgadas Full HD",
  "sku": "MON-SAM-24",
  "price": 299.99,
  "cost": 220.00,
  "stock": 15
}
```

### Importación CSV con Proveedores

El archivo CSV ahora puede incluir una columna `supplier` con el nombre del proveedor:

```csv
name,category,supplier,description,sku,price,cost,stock
"Monitor Samsung 24","Tecnología","Samsung Electronics","Monitor LED","MON-SAM-24",299.99,220.00,15
```

**Comportamiento durante la importación:**
1. Si el proveedor existe (por nombre), se asocia automáticamente
2. Si el proveedor no existe, se crea automáticamente con el nombre proporcionado
3. Si no se proporciona proveedor, el producto se crea sin proveedor asociado

---

## Permisos Requeridos

Todos los endpoints requieren:
- **Autenticación**: Usuario autenticado
- **Contexto de tenant**: Operación dentro del tenant del usuario
- **Permisos específicos**:
  - `suppliers:read` - Para listar y ver proveedores
  - `suppliers:create` - Para crear proveedores
  - `suppliers:update` - Para actualizar proveedores  
  - `suppliers:delete` - Para eliminar proveedores

---

## Códigos de Error Comunes

- **400 Bad Request**: Datos de entrada inválidos
- **401 Unauthorized**: Usuario no autenticado
- **403 Forbidden**: Sin permisos suficientes
- **404 Not Found**: Proveedor no encontrado
- **422 Validation Error**: 
  - Documento/email duplicado
  - Intento de eliminar proveedor con productos asociados
  - Límite de proveedores alcanzado (plan básico)

---

## Ejemplos de Uso Completo

### Flujo Completo: Crear Proveedor y Producto

1. **Crear proveedor:**
```bash
POST /v1/suppliers
{
  "name": "Samsung Electronics",
  "contact_name": "Juan Pérez",
  "document": "20123456789",
  "email": "contacto@samsung.com"
}
```

2. **Crear producto asociado:**
```bash
POST /v1/products
{
  "name": "Monitor Samsung 24 pulgadas",
  "supplier_id": "123e4567-e89b-12d3-a456-426614174000",
  "price": 299.99
}
```

3. **Importar productos con proveedores via CSV:**
```bash
POST /v1/products/import
# Archivo CSV con columna 'supplier'
```

---

Esta implementación proporciona una gestión completa de proveedores integrada con el sistema de productos existente, manteniendo la consistencia y facilitando el seguimiento de la procedencia de los productos en tu inventario.