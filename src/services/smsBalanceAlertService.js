/**
 * SMS Balance Alert Service
 * Compara los créditos SMS vendidos y aún no consumidos (suma de tenants.sms_balance)
 * contra el saldo real de la cuenta Twilio. Si el saldo no alcanza para cubrirlos
 * con margen, deja la alerta en sms_balance_checks (banner del panel admin) y avisa
 * por SMS a los superadmins configurados en SMS_ADMIN_ALERT_PHONES.
 *
 * Lo corre el scheduler (SMS_BALANCE_CHECK_CRON) y también se puede disparar
 * a mano desde el panel admin.
 */
const { Tenant, SmsBalanceCheck, SmsLog } = require('../models');
const env = require('../config/env');
const smsService = require('./smsService');
const logger = require('../utils/logger');

// No repetir la misma alerta por SMS más de una vez al día.
const ALERT_REPEAT_MS = 24 * 60 * 60 * 1000;

const round2 = (n) => Math.round(n * 100) / 100;

/** ok | warning | critical según cuánto cubre el saldo del proveedor. */
function evaluateStatus(providerBalance, committedCost, ratio = env.sms.alertRatio) {
  if (committedCost <= 0) return 'ok';
  if (providerBalance < committedCost) return 'critical';
  if (providerBalance < committedCost * ratio) return 'warning';
  return 'ok';
}

function buildAlertMessage({ status, providerBalance, currency, committedCredits, committedCost }) {
  if (status === 'error') {
    return 'Punto Fresco ALERTA SMS: no se pudo consultar el saldo de Twilio. Revisa el panel admin.';
  }
  const label = status === 'critical' ? 'CRITICA' : 'PREVENTIVA';
  return `Punto Fresco ALERTA SMS ${label}: saldo Twilio ${currency} ${round2(providerBalance)} vs ${committedCredits} creditos vendidos (~${currency} ${round2(committedCost)}). Recarga Twilio.`;
}

async function shouldSendAlert(status) {
  if (status === 'ok') return false;
  const lastAlert = await SmsBalanceCheck.findOne({
    where: { alert_sent: true },
    order: [['created_at', 'DESC']],
  });
  if (!lastAlert) return true;
  if (lastAlert.status !== status) return true;
  return Date.now() - new Date(lastAlert.created_at).getTime() > ALERT_REPEAT_MS;
}

async function notifyAdmins(body) {
  let anySent = false;
  for (const phone of env.sms.adminAlertPhones) {
    const result = await smsService.sendSms(phone, body, { kind: 'admin_alert' });
    anySent = anySent || result.ok;
    try {
      await SmsLog.create({
        tenant_id: null,
        kind: 'admin_alert',
        status: result.ok ? 'sent' : (result.skipped ? 'skipped' : 'failed'),
        skip_reason: result.skipped ?? null,
        to_masked: smsService.maskPhone(phone),
        provider_sid: result.sid ?? null,
        segments: result.segments ?? null,
        error_code: Number.isInteger(result.code) ? result.code : null,
        error_message: result.error ?? null,
      });
    } catch (error) {
      logger.error('sms-balance', 'Could not write admin alert log', { error });
    }
  }
  return anySent;
}

/**
 * Corre el chequeo, guarda el resultado y alerta si corresponde.
 * @returns {Promise<SmsBalanceCheck>}
 */
async function runCheck() {
  const committedCredits = Number(await Tenant.sum('sms_balance')) || 0;
  const committedCost = committedCredits * env.sms.unitCostUsd;

  let providerBalance = null;
  let currency = null;
  let status;
  let errorMessage = null;

  try {
    const balance = await smsService.getAccountBalance();
    providerBalance = balance.balance;
    currency = balance.currency;
    status = evaluateStatus(providerBalance, committedCost);
  } catch (error) {
    status = 'error';
    errorMessage = error.message;
    logger.error('sms-balance', 'Could not fetch provider balance', { error });
  }

  let alertSent = false;
  if (await shouldSendAlert(status)) {
    const body = buildAlertMessage({
      status,
      providerBalance,
      currency: currency || 'USD',
      committedCredits,
      committedCost,
    });
    alertSent = await notifyAdmins(body);
  }

  const check = await SmsBalanceCheck.create({
    provider_balance: providerBalance,
    provider_currency: currency,
    committed_credits: committedCredits,
    committed_cost: round2(committedCost),
    status,
    error_message: errorMessage,
    alert_sent: alertSent,
  });

  const level = status === 'ok' ? 'info' : 'warn';
  logger[level]('sms-balance', 'SMS balance check completed', {
    status,
    providerBalance,
    currency,
    committedCredits,
    committedCost: round2(committedCost),
    alertSent,
  });

  return check;
}

module.exports = { runCheck, evaluateStatus, buildAlertMessage };
