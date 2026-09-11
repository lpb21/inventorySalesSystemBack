/**
 * Scheduler
 * Programa tareas periódicas del sistema.
 * Actualmente: cancelación automática de suscripciones vencidas (trials y mora).
 */
const cron = require('node-cron');
const logger = require('../utils/logger');
const billingService = require('../services/billingService');

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
}

module.exports = { startScheduler };
