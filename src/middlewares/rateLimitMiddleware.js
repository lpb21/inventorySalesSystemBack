/**
 * Rate Limiting Middleware
 * Protege la API contra saturación de peticiones
 */
const rateLimit = require('express-rate-limit');

// Store para Redis (próximamente)
// const RedisStore = require('rate-limit-redis');
// const redisClient = require('../config/redis');

/**
 * Rate limiter general para todos los endpoints
 * 100 requests por minuto por IP
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por ventana de tiempo
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas peticiones. Intenta nuevamente en unos minutos.',
      retryAfter: 60
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Rate limiter estricto para autenticación
 * 20 intentos por 15 minutos por IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos de login por 15 minutos
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación. Intenta nuevamente en 15 minutos.',
      retryAfter: 900
    }
  },
  // Incrementar contador solo en fallos de autenticación
  skip: (req, res) => res.statusCode < 400,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para uploads de archivos (CSV)
 * 5 uploads por 5 minutos por usuario autenticado
 */
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // 5 uploads por ventana
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados archivos subidos. Intenta nuevamente en 5 minutos.',
      retryAfter: 300
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para reportes
 * 10 reportes por minuto por usuario
 */
const reportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 reportes por minuto
  message: {
    success: false,
    error: {
      code: 'REPORT_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes de reportes. Intenta nuevamente en un minuto.',
      retryAfter: 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para operaciones de escritura intensivas
 * 50 operaciones por minuto por usuario
 */
const writeOperationsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // 50 escrituras por minuto
  message: {
    success: false,
    error: {
      code: 'WRITE_RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones de escritura. Intenta nuevamente en un minuto.',
      retryAfter: 60
    }
  },
  // Solo aplicar a métodos que modifican datos
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter personalizado por tenant
 * Límite dinámico basado en el plan del tenant
 */
const createTenantLimiter = (maxRequests = 200) => {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: maxRequests,
    message: {
      success: false,
      error: {
        code: 'TENANT_RATE_LIMIT_EXCEEDED',
        message: 'Límite de peticiones del plan excedido. Considera actualizar tu plan.',
        retryAfter: 60
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Middleware de logging para rate limiting
 */
const rateLimitLogger = (req, res, next) => {
  // Guardar el timestamp original
  const originalSend = res.send;
  
  res.send = function(data) {
    // Si la respuesta es un rate limit (429)
    if (res.statusCode === 429) {
      console.warn('🚫 [RATE LIMIT] Blocked request:', {
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        tenantId: req.tenantId,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  reportLimiter,
  writeOperationsLimiter,
  createTenantLimiter,
  rateLimitLogger
};