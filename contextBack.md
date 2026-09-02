# Punto Fresco — Backend (Contexto para agentes)

> Contexto del repositorio **backend** (`inventorySalesSystemBack`, rama `invSalesBackend`). Léelo antes de trabajar aquí. Para el producto completo, ver también el contexto del frontend y la landing. Última actualización: septiembre 2026.

---

## Qué es este repo

API backend de **Punto Fresco**, un SaaS POS/inventario multi-tenant para salsamentarías colombianas (embutidos, quesos, carnes frías, pollo). Cada negocio es un `tenant` con datos aislados por `tenant_id`.

## Stack

- **Node.js + Express**
- **Sequelize** (ORM) sobre **PostgreSQL** (Supabase en producción)
- **Redis** para caché (cache de tenant, invalidación tras cambios)
- **JWT + RBAC** para auth y permisos
- **Jest** para tests (`cross-env NODE_ENV=test jest --runInBand`)
- **Umzug** para migraciones versionadas
- Despliegue: **EC2 + Nginx (reverse proxy) + PM2 (cluster) + SSL certbot**. Ver `DEPLOY.md`.

## Arranque local

```bash
docker start invleo-redis            # Redis (o docker run -d --name invleo-redis -p 6379:6379 redis:7-alpine)
npm run dev                          # levanta el back
# Para tests:
docker compose -f docker-compose.test.yml up -d   # Postgres de tests
npm test
```

El back necesita Redis para funcionar. Los tests necesitan además el Postgres de tests (contenedor aparte). Sin ese contenedor, `npm test` falla.

## Estructura

- `src/config/` — env, database, **plans.js** (límites por plan)
- `src/models/` — Sequelize (Tenant, User, Product, Sale, TenantSubscription, AuditLog, Recipe, etc.)
- `src/controllers/` — controladores (adminController, saleController, reportController, etc.)
- `src/services/` — lógica de negocio (saleService, adminSubscriptionService, auditService, etc.)
- `src/routes/v1/` — rutas versionadas
- `src/middlewares/` — tenantMiddleware (aislamiento + validación de suscripción), planMiddleware (enforcement de features), errorMiddleware
- `src/migrations/` — migraciones Umzug (`npm run migrate`)
- `tests/` — 44 tests en 9 archivos

## Modelo de suscripciones (IMPORTANTE)

- **Modelo de negocio A: cobrar por TIEMPO, no por funcionalidad.** Todos los clientes reciben todas las features. Se asigna el plan `enterprise` (todo en `true`) a todos.
- **Períodos** (en `src/utils/subscriptionDates.js`): `trial` (7d), `monthly` (30d), `quarterly` (90d), `biannual` (180d), `yearly` (365d).
- **Activación/suspensión MANUAL** por superadmin vía `adminSubscriptionService` (`activate` / `deactivate`). No hay pago automático.
- El `tenantMiddleware` valida `subscription_status`: un tenant `suspended` o vencido queda bloqueado automáticamente para operar.
- **`plans.js` existe con free/basic/pro/enterprise** (límites maxUsers/maxProducts/maxCashRegisters + features advancedReports/apiAccess/prioritySupport). Es la infraestructura del "modelo B" (por funcionalidad), hoy DORMIDA. `apiAccess` está declarado pero no se usa en ningún endpoint. `advancedReports` SÍ se aplica (gatea reportes avanzados y auditoría).

## Endpoints clave

- `POST /v1/sales` — crear venta. **Valida stock** (imposible vender de más) y **calcula el precio server-side desde la BD** (nunca confía en el precio del cliente). Descuenta stock con lock de fila.
- `POST /v1/inventory/transform` — despiece (1 origen → N cortes, con merma libre).
- CRUD `/v1/recipes` — recetas de despiece.
- `GET /v1/products/barcode/:code` — buscar producto por código de barras.
- `POST /v1/admin/tenants/:id/activate` y `/deactivate` — gestión de suscripciones (superadmin).
- `GET /v1/admin/tenants` — lista tenants (excluye el tenant del superadmin).
- `GET /v1/admin/audit-logs` — auditoría global paginada, con filtros `tenantId` y `action`.
- `GET /health` — health check (verifica BD y Redis).

## Decisiones y reglas clave

- **Precio siempre desde la BD** en la venta (seguridad).
- **Superadmin** tiene `tenant_id = NULL` (o `role = 'superadmin'`); se excluye del listado de tenants para que no pueda autosuspenderse.
- **Auditoría** (`audit_logs`): cada acción registra user_id (quién), action (qué), entity, description y created_at (cuándo). Tabla con índices por tenant_id+created_at, entity_type, action, user_id → escala con paginación.
- **Errores endurecidos** (errorMiddleware): en producción, errores inesperados muestran mensaje genérico (no filtran detalles); errores conocidos/operacionales sí muestran mensaje.
- **JWT_EXPIRES_IN = 2d**.
- El módulo bcrypt del proyecto es **bcryptjs**.

## Pendientes / deuda técnica

- **Facturación electrónica DIAN** (Fase 2, pendiente #1 — obligatoria en Colombia).
- Flag `is_global` en Tenant para identificar el tenant admin (hoy se excluye por nombre/patrón — pragmático).
- Costeo automático del despiece (opcional).

## Estilo de trabajo

- Planear antes de codear, verificar cada paso.
- Commits desde terminal Ubuntu (WSL2), Conventional Commits.
- Tests como red de seguridad; correr `npm test` tras cambios de lógica.
- Migraciones versionadas: nunca `sequelize.sync()` en prod, siempre `npm run migrate`.