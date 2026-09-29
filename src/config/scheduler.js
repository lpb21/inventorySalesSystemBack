/**
 * Scheduler
 * Programa tareas periódicas del sistema.
 * Actualmente: cancelación automática de suscripciones vencidas (trials y mora)
 * y chequeo de saldo Twilio vs créditos SMS vendidos.
 */
const cron = require('node-cron');
const logger = require('../utils/logger');
const billingService = require('../services/billingService');
const smsBalanceAlertService = require('../services/smsBalanceAlertService');
const env = require('./env');

// Por defecto diario a las 04:00 (hora del servidor). Sobrescribible con SUBSCRIPTION_SYNC_CRON.
const CRON_SCHEDULE = process.env.SUBSCRIPTION_SYNC_CRON || '0 4 * * *';

function startScheduler() {
  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info('scheduler', 'Iniciando cancelación automática de suscripciones vencidas');

    try {
      const result = await billingService.enforceOverdueSubscriptions();
      logger.info('scheduler', 'Cancelación de suscripciones completada', {
        scanned: result.scanned,
        updated: result.updated,
        overdue: result.overdue,
        expiredTrials: result.expiredTrials,
      });
    } catch (error) {
      logger.error('scheduler', 'Error cancelando suscripciones vencidas', { error: error.message });
    }
  });

  logger.info('scheduler', `Scheduler de suscripciones iniciado (cron: ${CRON_SCHEDULE})`);

  // Chequeo de saldo Twilio vs créditos SMS vendidos a los tenants.
  cron.schedule(env.sms.balanceCheckCron, async () => {
    try {
      await smsBalanceAlertService.runCheck();
    } catch (error) {
      logger.error('scheduler', 'Error en el chequeo de saldo SMS', { error: error.message });
    }
  });

  logger.info('scheduler', `Chequeo de saldo SMS iniciado (cron: ${env.sms.balanceCheckCron})`);
}

module.exports = { startScheduler };
