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

    app.listen(PORT, () => {
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

startServer();
