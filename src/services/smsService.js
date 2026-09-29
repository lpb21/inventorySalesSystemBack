/**
 * SMS Service
 * Capa de transporte SMS (hoy Twilio). Si se cambia de proveedor, solo se
 * reescribe este archivo: el resto del sistema solo conoce sendSms(to, body).
 *
 * Nunca lanza: devuelve { ok, ... } y deja registro en log de cada intento,
 * para que una venta o un abono jamás se caigan por culpa de un SMS.
 */
const env = require('../config/env');
const logger = require('../utils/logger');

// 21614: el número destino no es celular (ej. fijo de Bogotá 601...).
const TWILIO_NOT_MOBILE = 21614;

let client = null;

function getClient() {
  if (!client) {
    const twilio = require('twilio');
    client = twilio(env.twilio.accountSid, env.twilio.authToken);
  }
  return client;
}

// Tope mensual en memoria: salvaguarda de costo mientras se prueba.
const usage = { month: null, count: 0 };

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // '2026-09'
}

function capReached() {
  const month = currentMonth();
  if (usage.month !== month) {
    usage.month = month;
    usage.count = 0;
  }
  return env.sms.monthlyCap > 0 && usage.count >= env.sms.monthlyCap;
}

// No dejar el número completo en logs.
const maskPhone = (e164) => `***${String(e164).slice(-4)}`;

/**
 * Envía un SMS.
 * @param {string} to    número en E.164 ('+573001234567')
 * @param {string} body  texto plano
 * @param {object} [meta] datos extra para el log (tenantId, customerId, kind)
 * @returns {Promise<{ ok: boolean, sid?: string, segments?: number, skipped?: string, error?: string, code?: number }>}
 */
async function sendSms(to, body, meta = {}) {
  const logMeta = { ...meta, to: maskPhone(to), length: body.length };

  if (!env.sms.enabled) {
    logger.debug('sms', 'SMS disabled, skipping send', logMeta);
    return { ok: false, skipped: 'disabled' };
  }

  if (!env.twilio.accountSid || !env.twilio.authToken || !env.twilio.phoneNumber) {
    logger.warn('sms', 'Twilio credentials missing, skipping send', logMeta);
    return { ok: false, skipped: 'not_configured' };
  }

  if (capReached()) {
    logger.warn('sms', 'Monthly SMS cap reached, skipping send', {
      ...logMeta,
      cap: env.sms.monthlyCap,
      sentThisMonth: usage.count,
    });
    return { ok: false, skipped: 'monthly_cap' };
  }

  try {
    const message = await getClient().messages.create({
      to,
      from: env.twilio.phoneNumber,
      body,
    });
    usage.count += 1;

    logger.info('sms', 'SMS sent', {
      ...logMeta,
      sid: message.sid,
      status: message.status,
      segments: message.numSegments,
      sentThisMonth: usage.count,
    });
    return { ok: true, sid: message.sid, segments: Number(message.numSegments) || undefined };
  } catch (error) {
    if (error.code === TWILIO_NOT_MOBILE) {
      logger.warn('sms', 'SMS not sent: destination is not a mobile number', {
        ...logMeta,
        code: error.code,
      });
    } else {
      logger.error('sms', 'SMS send failed', {
        ...logMeta,
        code: error.code,
        status: error.status,
        error,
      });
    }
    return { ok: false, error: error.message, code: error.code };
  }
}

/**
 * Saldo actual de la cuenta del proveedor.
 * A diferencia de sendSms, SÍ lanza: lo usa el job de alertas, que registra el error.
 * @returns {Promise<{ balance: number, currency: string }>}
 */
async function getAccountBalance() {
  if (!env.twilio.accountSid || !env.twilio.authToken) {
    throw new Error('Twilio credentials missing');
  }
  const result = await getClient().api.v2010.accounts(env.twilio.accountSid).balance.fetch();
  return { balance: Number(result.balance), currency: result.currency };
}

module.exports = { sendSms, getAccountBalance, maskPhone };
