/**
 * Server Entry Point
 * Starts the Express server
 */
require('dotenv').config();
const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

const PORT = env.port;
let server; // referencia al servidor HTTP, para poder cerrarlo
let shuttingDown = false;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('server', 'Database connection ready');

    try {
      const cacheService = require('./services/cacheService');
      cacheService.connect();
    } catch (cacheError) {
      logger.warn('server', 'Cache service could not be initialized', { error: cacheError.message });
    }

    server = app.listen(PORT, () => {
      logger.info('server', 'API listening', {
        app: 'invLeo',
        version: '1.0.0',
        port: PORT,
        environment: env.nodeEnv,
      });
    });
  } catch (error) {
    logger.error('server', 'Startup failed', { error: error.message });
    process.exit(1);
  }
};

/**
 * Apagado ordenado: deja de aceptar peticiones nuevas, espera a que terminen
 * las en curso, y cierra las conexiones a BD y Redis antes de salir.
 */
  const gracefulShutdown = async (signal) => {
    if (shuttingDown) return;   // ← si ya está apagando, ignora señales repetidas
    shuttingDown = true;

  logger.info('server', `Señal ${signal} recibida, iniciando apagado ordenado`);

  // 1) Dejar de aceptar conexiones nuevas y esperar a que terminen las activas
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    logger.info('server', 'Servidor HTTP cerrado (no acepta nuevas peticiones)');
  }

  // 2) Cerrar conexiones a recursos externos
  try {
    await sequelize.close();
    logger.info('server', 'Conexión a la base de datos cerrada');
  } catch (e) {
    logger.warn('server', 'Error cerrando la BD', { error: e.message });
  }

  try {
    const cacheService = require('./services/cacheService');
    if (cacheService.disconnect) {
      await cacheService.disconnect();
      logger.info('server', 'Conexión a Redis cerrada');
    }
  } catch (e) {
    logger.warn('server', 'Error cerrando Redis', { error: e.message });
  }

  logger.info('server', 'Apagado ordenado completo');
  process.exit(0);
};

// Red de seguridad: si el apagado se cuelga, forzar salida tras 10s
const forceExitAfter = (ms) => {
  setTimeout(() => {
    logger.error('server', 'Apagado forzado por timeout');
    process.exit(1);
  }, ms).unref();
};

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => {
    forceExitAfter(10000);
    gracefulShutdown(signal);
  });
});

startServer();