# 🛡️ Rate Limiting - Sistema de Protección API

## ✅ **IMPLEMENTADO EXITOSAMENTE**

El sistema de rate limiting ha sido implementado para proteger la API contra saturación de peticiones y garantizar estabilidad con múltiples usuarios simultáneos.

## 📊 **Límites Configurados**

### **1. Rate Limiter General** 
- **Alcance**: Todos los endpoints
- **Límite**: 100 requests por minuto por IP
- **Aplicado**: Globalmente en `app.js`

### **2. Rate Limiter de Autenticación**
- **Alcance**: `/v1/auth/*` (login, register, refresh-token) 
- **Límite**: 20 intentos por 15 minutos por IP
- **Especial**: Solo cuenta intentos fallidos (status >= 400)
- **Protección**: Ataques de fuerza bruta

### **3. Rate Limiter de Uploads**
- **Alcance**: `/v1/products/import` (upload CSV)
- **Límite**: 5 uploads por 5 minutos por usuario
- **Identificación**: Por `userId` si está autenticado, sino por IP
- **Protección**: Saturación del servidor con archivos

### **4. Rate Limiter de Reportes**
- **Alcance**: `/v1/reports/*` (todos los reportes)
- **Límite**: 10 reportes por minuto por usuario
- **Identificación**: Por `userId` si está autenticado, sino por IP
- **Protección**: Consultas pesadas de base de datos

### **5. Rate Limiter de Operaciones de Escritura**
- **Alcance**: POST, PUT, PATCH, DELETE en:
  - `/v1/products/*` (crear, actualizar productos)
  - `/v1/sales/*` (crear, cancelar ventas)
  - `/v1/suppliers/*` (CRUD suppliers)
  - `/v1/categories/*` (CRUD categorías)
- **Límite**: 50 operaciones por minuto por usuario
- **Identificación**: Por `userId` si está autenticado, sino por IP
- **Protección**: Modificaciones masivas de datos

## 🚫 **Respuestas de Error**

Cuando se excede un límite, la API responde con **HTTP 429** y este formato:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Demasiadas peticiones. Intenta nuevamente en unos minutos.",
    "retryAfter": 60
  }
}
```

### **Códigos de Error por Tipo**:
- `RATE_LIMIT_EXCEEDED` - Límite general
- `AUTH_RATE_LIMIT_EXCEEDED` - Límite de autenticación  
- `UPLOAD_RATE_LIMIT_EXCEEDED` - Límite de uploads
- `REPORT_RATE_LIMIT_EXCEEDED` - Límite de reportes
- `WRITE_RATE_LIMIT_EXCEEDED` - Límite de operaciones de escritura

## 📈 **Headers de Respuesta**

Todas las respuestas incluyen headers informativos:

```
RateLimit-Limit: 100           # Límite por ventana
RateLimit-Remaining: 95        # Requests restantes
RateLimit-Reset: 1647891234    # Timestamp cuando resetea
```

## 🔍 **Monitoring & Logs**

### **Logs de Rate Limiting**
Cada request bloqueado genera un log con:

```javascript
🚫 [RATE LIMIT] Blocked request: {
  ip: "192.168.1.100",
  method: "POST",
  url: "/v1/products/import", 
  userAgent: "Mozilla/5.0...",
  userId: "uuid-del-usuario",
  tenantId: "uuid-del-tenant",
  timestamp: "2026-03-10T18:30:00.000Z"
}
```

### **Métricas Importantes a Monitorear**:
- Cantidad de requests bloqueados por hora
- IPs que más requests bloqueados tienen
- Endpoints más afectados por rate limiting
- Usuarios con más límites excedidos

## 🔧 **Configuración Avanzada** 

### **Para usar con Redis (Escalabilidad)**:
```javascript
// Descomenta en rateLimitMiddleware.js
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');

const generalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  // ... resto de config
});
```

### **Rate Limiter por Plan de Tenant**:
```javascript
// Ya está preparado para usar
const tenantLimiter = createTenantLimiter(200); // 200 req/min para plan premium
router.use(tenantLimiter);
```

## 🎯 **Próximos Pasos Recomendados**

1. **Monitoreo en Producción**: Analizar logs para ajustar límites según uso real
2. **Integración con Redis**: Para escalabilidad horizontal 
3. **Rate Limiting Dinámico**: Límites basados en plan del tenant
4. **Alertas**: Configurar alertas cuando se exceden límites frecuentemente
5. **Whitelist**: IPs confiables que no tienen límites

## ✅ **Estado Actual**

- ✅ Rate limiting básico implementado
- ✅ Protección contra ataques de fuerza bruta
- ✅ Límites específicos por tipo de endpoint  
- ✅ Logging detallado de requests bloqueados
- ✅ Headers informativos para clientes
- ✅ Identificación por usuario autenticado
- 🟡 Redis store (preparado, no activado)
- 🟡 Rate limiting dinámico por plan

## 📞 **Testing**

Para probar que funciona:

```bash
# Test límite general (hacer >100 requests en 1 minuto)
for i in {1..101}; do
  curl -X GET http://localhost:3000/v1/products
  echo "Request $i"
done

# Test límite de auth (hacer >20 logins fallidos en 15 min)  
for i in {1..21}; do
  curl -X POST http://localhost:3000/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"fake@test.com","password":"wrong"}'
done
```

¡El sistema está **blindado** y listo para producción! 🚀