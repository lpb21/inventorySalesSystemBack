/**
 * Customer Notification Service
 * Envía al cliente el aviso de un fiado o de un abono CUANDO EL TENDERO LO PIDE
 * (botón "Enviar notificación por SMS" en el modal). Nada se envía automáticamente.
 *
 * Doble control del tendero:
 * 1. Por cliente, en Configuración: customer.whatsapp_notifications_enabled
 *    (la columna conserva el nombre por historia; es el interruptor de avisos
 *    al cliente sin importar el canal).
 * 2. Por operación: decide en el modal si envía o no.
 *
 * Hoy el único canal es SMS. Cuando se integre la API de Meta (WhatsApp Business),
 * se agrega aquí como otro canal.
 *
 * Cada SMS consume 1 crédito prepago del tenant (smsCreditService). Un mismo
 * fiado/abono solo se puede notificar una vez con éxito (índices únicos de sms_logs);
 * si el envío falla, se devuelve el crédito y se puede reintentar.
 */
const { UniqueConstraintError } = require('sequelize');
const { Customer, CustomerPayment, Sale, SmsLog } = require('../models');
const smsService = require('./smsService');
const smsCreditService = require('./smsCreditService');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const { buildSmsChargeMessage, buildSmsPaymentMessage } = require('../utils/smsMessages');

const TWILIO_NOT_MOBILE = 21614;

// Textos para el toast del tendero según el resultado.
const RESULT_MESSAGES = {
  sent: 'Notificación SMS enviada',
  disabled: 'Los SMS no están activos en tu cuenta. Escríbenos por WhatsApp para activarlos.',
  no_balance: 'No te quedan SMS. Recarga en Configuración > Mensajes SMS.',
  not_mobile: 'El número del cliente no es un celular válido para SMS.',
  unavailable: 'El servicio de SMS no está disponible en este momento. Intenta más tarde.',
  failed: 'No se pudo enviar el SMS. Intenta de nuevo.',
};

// Misma condición que el interruptor del cliente en Configuración.
function canNotify(customer) {
  return Boolean(
    customer && customer.whatsapp_notifications_enabled !== false && customer.phone_e164
  );
}

function assertCustomerCanBeNotified(customer) {
  if (!customer) throw new NotFoundError('Cliente no encontrado');
  if (!customer.phone_e164) {
    throw new ValidationError('Este cliente no tiene celular registrado');
  }
  if (customer.whatsapp_notifications_enabled === false) {
    throw new ValidationError('Este cliente tiene los avisos por SMS desactivados en Configuración');
  }
}

async function writeLog(data) {
  try {
    return await SmsLog.create(data);
  } catch (error) {
    logger.error('customer-notification', 'Could not write sms_logs row', { error });
    return null;
  }
}

/**
 * Reserva crédito -> marca el aviso como "pending" (bloquea el doble envío)
 * -> envía -> deja el resultado en el log y en el libro de créditos.
 */
async function send({ tenantId, customer, kind, reference, buildBody }) {
  const base = {
    tenant_id: tenantId,
    customer_id: customer.id,
    kind,
    to_masked: smsService.maskPhone(customer.phone_e164),
    ...reference,
  };

  const reservation = await smsCreditService.reserveCredit(tenantId);
  if (!reservation.reserved) {
    if (reservation.reason === 'no_balance') {
      await writeLog({ ...base, status: 'skipped', skip_reason: 'no_balance' });
    }
    const reason = reservation.reason === 'no_balance' ? 'no_balance' : 'disabled';
    return { sent: false, reason, message: RESULT_MESSAGES[reason] };
  }

  let log;
  try {
    log = await SmsLog.create({ ...base, status: 'pending' });
  } catch (error) {
    await smsCreditService.releaseCredit(tenantId);
    if (error instanceof UniqueConstraintError) {
      throw new ConflictError('Esta notificación ya fue enviada al cliente');
    }
    throw error;
  }

  let result;
  try {
    result = await smsService.sendSms(customer.phone_e164, buildBody(reservation.businessName), {
      kind,
      tenantId,
      customerId: customer.id,
    });
  } catch (error) {
    result = { ok: false, error: error.message };
  }

  if (result.ok) {
    await log.update({
      status: 'sent',
      provider_sid: result.sid,
      segments: result.segments ?? null,
    });
    await smsCreditService.recordConsumption(tenantId, reservation.balance, log.id);
    return {
      sent: true,
      reason: null,
      message: RESULT_MESSAGES.sent,
      to: base.to_masked,
      sms_balance: reservation.balance,
    };
  }

  // No salió: se devuelve el crédito y el aviso queda libre para reintentar.
  await smsCreditService.releaseCredit(tenantId);
  await log.update({
    status: result.skipped ? 'skipped' : 'failed',
    skip_reason: result.skipped ?? null,
    error_code: Number.isInteger(result.code) ? result.code : null,
    error_message: result.error ?? null,
  });

  let reason = 'failed';
  if (result.code === TWILIO_NOT_MOBILE) reason = 'not_mobile';
  else if (result.skipped) reason = 'unavailable';
  return { sent: false, reason, message: RESULT_MESSAGES[reason] };
}

/**
 * Aviso de fiado: POST /v1/sales/:id/notify-sms
 */
async function notifySale(tenantId, saleId) {
  const sale = await Sale.findOne({ where: { id: saleId, tenant_id: tenantId } });
  if (!sale) throw new NotFoundError('Venta no encontrada');
  if (sale.payment_method !== 'credit' || !sale.customer_id) {
    throw new ValidationError('Solo se pueden notificar ventas a crédito (fiados)');
  }
  if (sale.status !== 'completed') {
    throw new ValidationError('La venta no está vigente');
  }

  const customer = await Customer.findOne({ where: { id: sale.customer_id, tenant_id: tenantId } });
  assertCustomerCanBeNotified(customer);

  return send({
    tenantId,
    customer,
    kind: 'credit_charge',
    reference: { sale_id: sale.id },
    // Saldo actual del cliente: si se envía justo después del fiado, es el saldo tras la venta.
    buildBody: (businessName) => buildSmsChargeMessage({
      businessName,
      total: sale.total,
      balance: customer.credit_balance,
    }),
  });
}

/**
 * Aviso de abono: POST /v1/customers/:customerId/payments/:paymentId/notify-sms
 */
async function notifyPayment(tenantId, customerId, paymentId) {
  const payment = await CustomerPayment.findOne({
    where: { id: paymentId, tenant_id: tenantId, customer_id: customerId },
  });
  if (!payment) throw new NotFoundError('Abono no encontrado');

  const customer = await Customer.findOne({ where: { id: customerId, tenant_id: tenantId } });
  assertCustomerCanBeNotified(customer);

  return send({
    tenantId,
    customer,
    kind: 'credit_payment',
    reference: { customer_payment_id: payment.id },
    buildBody: (businessName) => buildSmsPaymentMessage({
      businessName,
      amount: payment.amount,
      balance: customer.credit_balance,
    }),
  });
}

module.exports = { canNotify, notifySale, notifyPayment, RESULT_MESSAGES };
