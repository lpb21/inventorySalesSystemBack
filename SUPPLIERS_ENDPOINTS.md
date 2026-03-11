# 📋 DOCUMENTACIÓN COMPLETA - ENDPOINTS DE SUPPLIERS

## 🔧 **IMPLEMENTACIÓN TÉCNICA**

### **Headers Requeridos en TODOS los endpoints:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### **Base URL:** `http://localhost:3000/v1/suppliers`

---

## 📝 **1. GET /v1/suppliers - Listar Proveedores**

### **Parámetros de consulta (Query Params):**
- `page` (opcional): Página actual (default: 1)
- `limit` (opcional): Elementos por página (default: 20)
- `include_inactive` (opcional): "true" muestra solo inactivos, omitir o "false" muestra solo activos

### **Ejemplo de Request:**
```bash
GET /v1/suppliers?page=1&limit=10
```

### **Respuesta JSON:**
```json
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": "232dc12c-21a7-4906-a1d9-3f9fa19e432e",
        "tenant_id": "9b949ff1-3873-4b74-b950-6fc23314354a",
        "name": "Arepas Ricas S.A.",
        "contact_name": "Juan Casas",
        "document": "25874169",
        "email": "arepas@arepas.com",
        "phone": "625874",
        "address": "Carrera 365 #154",
        "notes": "Proveedor de arepas con queso",
        "is_active": true,
        "created_at": "2026-03-10T18:27:04.188Z",
        "updated_at": "2026-03-10T18:27:39.521Z",
        "products": [],
        "product_count": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## ➕ **2. POST /v1/suppliers - Crear Proveedor**

### **JSON de entrada (Request Body):**
```json
{
  "name": "Lácteos del Valle",
  "contact_name": "María González",
  "document": "900123456-1",
  "email": "info@lacteosdelalle.com",
  "phone": "+57 310 123 4567",
  "address": "Calle 50 #45-30, Bogotá",
  "notes": "Proveedor principal de productos lácteos"
}
```

### **Campos requeridos:**
- ✅ `name` (string, máx 255 chars) - **OBLIGATORIO**

### **Campos opcionales:**
- `contact_name` (string, máx 255 chars)
- `document` (string, máx 50 chars)
- `email` (string, formato email válido)
- `phone` (string, máx 50 chars)
- `address` (string, máx 1000 chars)
- `notes` (string, máx 1000 chars)
- `is_active` (boolean, default: true)

### **Respuesta JSON:**
```json
{
  "success": true,
  "data": {
    "id": "new-supplier-uuid",
    "tenant_id": "tenant-uuid",
    "name": "Lácteos del Valle",
    "contact_name": "María González",
    "document": "900123456-1",
    "email": "info@lacteosdelalle.com",
    "phone": "+57 310 123 4567",
    "address": "Calle 50 #45-30, Bogotá",
    "notes": "Proveedor principal de productos lácteos",
    "is_active": true,
    "created_at": "2026-03-10T23:45:00.000Z",
    "updated_at": "2026-03-10T23:45:00.000Z"
  }
}
```

---

## 🎯 **3. GET /v1/suppliers/select - Proveedores para Dropdown**

### **Ejemplo de Request:**
```bash
GET /v1/suppliers/select
```

### **Respuesta JSON (formato simplificado):**
```json
{
  "success": true,
  "data": [
    {
      "id": "supplier-uuid-1",
      "name": "Arepas Ricas S.A."
    },
    {
      "id": "supplier-uuid-2", 
      "name": "Lácteos del Valle"
    }
  ]
}
```

---

## 🔍 **4. GET /v1/suppliers/:id - Obtener Proveedor por ID**

### **Ejemplo de Request:**
```bash
GET /v1/suppliers/232dc12c-21a7-4906-a1d9-3f9fa19e432e
```

### **Respuesta JSON:**
```json
{
  "success": true,
  "data": {
    "id": "232dc12c-21a7-4906-a1d9-3f9fa19e432e",
    "tenant_id": "9b949ff1-3873-4b74-b950-6fc23314354a",
    "name": "Arepas Ricas S.A.",
    "contact_name": "Juan Casas",
    "document": "25874169",
    "email": "arepas@arepas.com",
    "phone": "625874",
    "address": "Carrera 365 #154",
    "notes": "Proveedor de arepas con queso",
    "is_active": true,
    "created_at": "2026-03-10T18:27:04.188Z",
    "updated_at": "2026-03-10T18:27:39.521Z",
    "products": []
  }
}
```

---

## ✏️ **5. PUT /v1/suppliers/:id - Actualizar Proveedor**

### **JSON de entrada (Request Body):**
```json
{
  "name": "Arepas Ricas S.A.S.",
  "contact_name": "Juan Carlos Casas",
  "document": "900258741-1",
  "email": "ventas@arepasricas.com",
  "phone": "+57 310 625 874",
  "address": "Carrera 365 #154-20, Medellín",
  "notes": "Proveedor premium de arepas artesanales"
}
```

### **Campos opcionales para actualización:**
- Todos los campos son opcionales en PUT
- Solo se actualizan los campos enviados
- `name` puede ser opcional en actualizaciones

### **Respuesta JSON:**
```json
{
  "success": true,
  "data": {
    "id": "232dc12c-21a7-4906-a1d9-3f9fa19e432e",
    "tenant_id": "9b949ff1-3873-4b74-b950-6fc23314354a",
    "name": "Arepas Ricas S.A.S.",
    "contact_name": "Juan Carlos Casas",
    "document": "900258741-1",
    "email": "ventas@arepasricas.com",
    "phone": "+57 310 625 874",
    "address": "Carrera 365 #154-20, Medellín",
    "notes": "Proveedor premium de arepas artesanales",
    "is_active": true,
    "created_at": "2026-03-10T18:27:04.188Z",
    "updated_at": "2026-03-10T23:50:00.000Z"
  }
}
```

---

## 🔄 **6. PATCH /v1/suppliers/:id/toggle-status - Cambiar Estado**

### **Request (sin body):**
```bash
PATCH /v1/suppliers/232dc12c-21a7-4906-a1d9-3f9fa19e432e/toggle-status
```

### **Respuesta JSON:**
```json
{
  "success": true,
  "data": {
    "id": "232dc12c-21a7-4906-a1d9-3f9fa19e432e",
    "name": "Arepas Ricas S.A.S.",
    "is_active": false,
    "updated_at": "2026-03-10T23:55:00.000Z",
    "message": "Estado del proveedor cambiado a inactivo"
  }
}
```

---

## 🗑️ **7. DELETE /v1/suppliers/:id - Eliminar Proveedor**

### **Request (sin body):**
```bash
DELETE /v1/suppliers/232dc12c-21a7-4906-a1d9-3f9fa19e432e
```

### **Respuesta JSON:**
```json
{
  "success": true,
  "data": {
    "message": "Proveedor eliminado correctamente",
    "deleted_id": "232dc12c-21a7-4906-a1d9-3f9fa19e432e"
  }
}
```

---

## ❌ **RESPUESTAS DE ERROR**

### **401 - Sin autenticación:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "No se proporcionó token de autenticación"
  }
}
```

### **400 - Datos inválidos:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos de entrada inválidos",
    "details": [
      "El nombre del proveedor es requerido",
      "El email debe tener un formato válido"
    ]
  }
}
```

### **404 - Proveedor no encontrado:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Proveedor no encontrado"
  }
}
```

### **429 - Rate Limiting (límite de peticiones):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Demasiadas peticiones. Intente nuevamente en 60 segundos.",
    "retryAfter": 60
  }
}
```

---

## 🛡️ **SEGURIDAD Y PERMISOS**

### **Permisos requeridos por endpoint:**
- `GET /suppliers` → `suppliers:read`
- `POST /suppliers` → `suppliers:create` + Rate Limit (50 req/min)
- `GET /suppliers/select` → `suppliers:read`
- `GET /suppliers/:id` → `suppliers:read`
- `PUT /suppliers/:id` → `suppliers:update` + Rate Limit
- `PATCH /suppliers/:id/toggle-status` → `suppliers:update` + Rate Limit  
- `DELETE /suppliers/:id` → `suppliers:delete` + Rate Limit

### **Rate Limiting:**
- **Operaciones de escritura:** 50 requests por minuto
- **Rate limit general:** 100 requests por minuto

---

## 🔄 **CACHE**
- Las consultas GET se cachean en Redis por **60 segundos**
- El cache se invalida automáticamente en operaciones CUD (Create, Update, Delete)
- Logs con emojis: 🚀 Cache Hit, 💾 Cache Miss, ⚠️ Cache Error

---

## 🧪 **CÓMO PROBAR**

### **1. Obtener token de autenticación:**
```bash
POST /v1/auth/login
{
  "email": "admin@mi-salsamentaria.com",
  "password": "admin123"
}
```

### **2. Usar el token en subsecuentes requests:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:3000/v1/suppliers
```