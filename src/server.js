/**
 * Server Entry Point
 * Starts the Express server
 */
require('dotenv').config();
const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');

const PORT = env.port;

const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Conexión a la BD exitosa');

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║   invLeo API Server                               ║
║   Version: 1.0.0                                  ║
║   Puerto: ${PORT}                                    ║
║   Entorno: ${env.nodeEnv}                            ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('✗ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();
