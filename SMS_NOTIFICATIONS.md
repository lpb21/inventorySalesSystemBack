# Notificaciones SMS a clientes de fiado

Aviso por SMS al cliente final cuando el tendero registra un **fiado** (venta a crédito) o un **abono**. Proveedor actual: Twilio. Los SMS son **prepago por tenant** y **nunca se envían automáticamente**: el tendero decide en cada operación.

## Decisiones de diseño

- **Envío manual.** Tras registrar un fiado (POS) o un abono (Cuentas por Cobrar) aparece un modal con el botón "Enviar notificación por SMS". Si el tendero cierra sin enviar, no se gasta nada.
- **Doble control del tendero.**
  1. Por cliente, en Configuración > Clientes (interruptor de avisos).
  2. Por operación, en el modal.
- **Columna `customers.whatsapp_notifications_enabled`: nombre histórico, se conserva a propósito.** Nació para el botón de WhatsApp (wa.me). Hoy es simplemente el interruptor "avisar o no a este cliente", sin importar el canal (SMS hoy, WhatsApp/Meta mañana). Renombrarla era solo cosmético y obligaba a tocar migración, modelo, rutas, front y tests; se decidió no hacerlo.
- **Habilitación por tenant (superadmin).** `tenants.sms_enabled` es independiente de la suscripción: un negocio con suscripción activa puede tener el SMS inactivo. Todo tenant (nuevo o existente) arranca con SMS inactivo y saldo 0.
- **Créditos prepago.** `tenants.sms_balance` (nunca negativo: `CHECK sms_balance >= 0`). 1 SMS = 1 crédito. Las recargas se **suman** al saldo. El tendero paga por fuera (WhatsApp de Punto Fresco) y el superadmin acredita desde el panel, igual que las suscripciones manuales.
- **Sin saldo, no se bloquea nada.** La venta/abono se registra; el SMS simplemente no sale y el modal ofrece "Recarga aquí por WhatsApp".
- **Canal intercambiable.** `smsService` es la única pieza que conoce a Twilio. La integración futura con WhatsApp Business (API de Meta) se agrega como otro canal en `customerNotificationService`.
- **Mensaje de 1 segmento.** Texto GSM-7 (sin tildes, emojis ni `*negritas*`), máximo 160 caracteres; montos formateados a mano (el `Intl` es-CO mete un espacio no GSM-7).
- **Se descartó** un límite de "1 SMS cada 60 s": con prepago el gasto lo decide y lo paga el tendero.

## Paquetes (`src/config/smsPackages.js`)

| Código | Nombre | SMS | Precio COP |
|---|---|---|---|
| small | Pequeño | 50 | 13.000 |
| medium | Mediano | 150 | 37.000 |
| large | Grande | 300 | 72.000 |
| xlarge | Extra grande | 600 | 138.000 |

Bono de bienvenida: 10 SMS, una sola vez por tenant, lo otorga el superadmin (también activa el servicio).

## Flujo de envío (`customerNotificationService.send`)

1. Valida venta/abono y que el cliente tenga celular y avisos activos.
2. `smsCreditService.reserveCredit`: `UPDATE ... SET sms_balance = sms_balance - 1 WHERE sms_enabled AND sms_balance > 0` (atómico; dos ventas simultáneas no gastan el mismo crédito).
3. Inserta `sms_logs` con `status = 'pending'`. Índices únicos parciales (`sale_id` / `customer_payment_id` con status `pending|sent`) impiden notificar dos veces la misma operación.
4. `smsService.sendSms` (Twilio). Éxito → log `sent` + movimiento `consumption` en el libro. Fallo (p. ej. 21614, número fijo) → se devuelve el crédito, log `failed`, se puede reintentar.

## Tablas (migraciones 010 y 011)

- `tenants.sms_enabled`, `tenants.sms_balance`
- `sms_credit_transactions`: libro de movimientos (`welcome_bonus`, `purchase`, `consumption`, `adjustment`) con precio, nota y quién acreditó.
- `sms_logs`: un registro por intento (`pending`, `sent`, `failed`, `skipped`), con `sale_id` / `customer_payment_id`.
- `sms_balance_checks`: resultado del job de saldo Twilio.
- `customer_payments`: ahora sí se escribe en cada abono (antes era un TODO); da el id para notificar el abono.

## Alerta de saldo Twilio (`smsBalanceAlertService`)

Cron `SMS_BALANCE_CHECK_CRON` (cada 6 h). Compara créditos vendidos sin usar × `SMS_UNIT_COST_USD` contra el saldo real de Twilio:
`critical` si no alcanza, `warning` si alcanza sin el margen `SMS_BALANCE_ALERT_RATIO`. Muestra banner en Admin > SMS y envía SMS a `SMS_ADMIN_ALERT_PHONES` (máximo una vez al día por estado).

## Endpoints

| Método | Ruta | Quién |
|---|---|---|
| GET | `/v1/sms/status` | cualquier usuario del tenant |
| POST | `/v1/sales/:id/notify-sms` | `sales:create` |
| POST | `/v1/customers/:id/payments/:paymentId/notify-sms` | `customers:create` |
| GET | `/v1/admin/sms/overview?page&limit&tenantId&sms&balance` | superadmin |
| POST | `/v1/admin/sms/balance-check` | superadmin |
| PATCH | `/v1/admin/tenants/:id/sms` | superadmin |
| POST | `/v1/admin/tenants/:id/sms/welcome-bonus` | superadmin |
| POST | `/v1/admin/tenants/:id/sms/credits` | superadmin |
| GET | `/v1/admin/tenants/:id/sms/transactions` · `/logs` | superadmin |

## Variables de entorno

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `SMS_ENABLED` (apagado en test), `SMS_MONTHLY_CAP` (freno global de emergencia), `SMS_UNIT_COST_USD`, `SMS_BALANCE_ALERT_RATIO`, `SMS_ADMIN_ALERT_PHONES`, `SMS_BALANCE_CHECK_CRON`.

## Relacionado: seguridad de `PUT /v1/tenants/:id`

Antes hacía `tenant.update(req.body)` sin validar rol ni empresa: cualquier usuario podía cambiar `sms_balance`, `sms_enabled` o `subscription_status` de cualquier tenant. Ahora: solo owner (su propia empresa) o superadmin, y solo `business_name`, `address`, `phone`. Lo usa Configuración > Datos del Negocio.
