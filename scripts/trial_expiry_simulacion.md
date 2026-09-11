# Simular vencimiento de suscripción (trial) — SQL crudo

Este documento contiene bloques de SQL para simular los estados del ciclo de vida
del **trial** directamente en la base de datos (PostgreSQL / Supabase).

> **Antes de ejecutar**, identifica el `slug` del tenant en la tabla `tenants` y
> reemplaza el valor `'mi-empresa'` en cada bloque.

Para conocer el `slug`:

```sql
SELECT id, name, slug, plan, subscription_status, is_active
FROM tenants
ORDER BY created_at DESC;
```

---

## Escenario 1 — Trial a punto de vencer (sigue activo)

Pone el fin del periodo a **N días en el futuro** (el tenant continúa operando y,
si quedan ≤ 4 días, verá el modal de aviso al iniciar sesión).

```sql
-- Cambia '3 days' por los días que necesites (ej. '4 days', '1 day')
UPDATE tenant_subscriptions
SET current_period_start = now(),
    current_period_end   = now() + interval '3 days',   -- ← edita los días
    grace_until          = NULL,
    status               = 'trial',
    last_payment_at      = now()
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'mi-empresa');  -- ← edita el slug

UPDATE tenants
SET subscription_status = 'trial',
    is_active            = true
WHERE slug = 'mi-empresa';  -- ← edita el slug
```

---

## Escenario 2 — Trial vencido → cancelar acceso

Simula el fin del trial: la suscripción queda **cancelada** y el tenant **pierde el
acceso** (no puede iniciar sesión).

```sql
UPDATE tenant_subscriptions
SET current_period_end = now() - interval '1 day',
    grace_until        = NULL,
    status             = 'cancelled',
    last_payment_failed_at = now()
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'mi-empresa');  -- ← edita el slug

UPDATE tenants
SET subscription_status = 'cancelled',
    is_active            = false
WHERE slug = 'mi-empresa';  -- ← edita el slug
```

---

## Verificación

Ejecuta esta consulta para confirmar el estado resultante:

```sql
SELECT t.slug,
       t.plan,
       t.subscription_status,
       t.is_active,
       ts.status                AS subscription_status_real,
       ts.plan_code,
       ts.current_period_start,
       ts.current_period_end,
       ts.grace_until
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
WHERE t.slug = 'mi-empresa';  -- ← edita el slug
```

- `days_left` esperado: `current_period_end - now()`.
- Escenario 1 → `status='trial'`, `subscription_status='trial'`, `is_active=true`.
- Escenario 2 → `status='cancelled'`, `subscription_status='cancelled'`, `is_active=false`.

---

## Nota sobre caché (Redis)

El tenant se cachea en Redis durante **5 minutos** (`TENANT_CACHE_TTL = 300`).
Tras ejecutar el SQL, para ver el efecto de inmediato:

- Limpia la clave del tenant: `redis-cli DEL "tenant:info:<uuid-del-tenant>"`, o
- Limpia toda la caché: `redis-cli FLUSHDB`, o
- Espera 5 minutos.

---

## Reactivar una suscripción cancelada (panel superadmin)

Un tenant cancelado **no pierde sus datos**. Para reactivarlo:

- Desde el panel: **Suscripciones → botón "Activar"** del tenant, eligiendo el
  periodo (trial / mensual / trimestral / semestral / anual).
- Por API: `POST /v1/admin/tenants/:id/activate` con `{ "period": "monthly" }`
  (solo superadmin).

Esto limpia la gracia, restaura `is_active = true` y vuelve a poner el estado
`active`/`trial` en ambas tablas (`tenant_subscriptions` y `tenants`).
