/**
 * Express App Configuration
 * Main application setup
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const errorMiddleware = require('./middlewares/errorMiddleware');
const { generalLimiter, rateLimitLogger } = require('./middlewares/rateLimitMiddleware');
const routes = require('./routes');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting (aplicar antes que otros middlewares)
app.use(rateLimitLogger);
app.use(generalLimiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps, curl, Postman, webhooks)
    if (!origin) {
      return callback(null, true);
    }

    // Verificar si el origin está en la lista de permitidos
    if (env.allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // En desarrollo, permitir cualquier origen localhost
      if (env.nodeEnv === 'development' && origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 horas
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API routes with /v1 prefix
app.use('/v1', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'invLeo API',
    version: '1.0.0',
    description: 'Sistema de Gestión de Inventarios para Salsamentarías',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint no encontrado',
    },
  });
});

// Error handling
app.use(errorMiddleware);

module.exports = app;
