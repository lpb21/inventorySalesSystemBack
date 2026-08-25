/**
 * Error Middleware
 * Handles errors and returns proper JSON responses.
 * En producción, los errores inesperados (500) NO exponen detalles internos al cliente.
 */
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  // Siempre registrar el error completo en el logger (para que TÚ lo veas en tus logs)
  logger.error('http', 'Error en petición', {
    message: err.message,
    name: err.name,
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Error por defecto
  let error = {
    message: 'Error interno del servidor',
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || 'INTERNAL_ERROR',
  };

  // Marca si el error es "seguro de mostrar" al cliente
  let safeToExpose = false;

  // Errores conocidos de Sequelize
  if (err.name === 'SequelizeValidationError') {
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    error.message = 'Error de validación';
    error.details = err.errors.map((e) => e.message);
    safeToExpose = true;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    error.statusCode = 409;
    error.errorCode = 'DUPLICATE_ERROR';
    error.message = 'El recurso ya existe';
    error.details = err.errors.map((e) => e.message);
    safeToExpose = true;
  } else if (err.name === 'SequelizeDatabaseError') {
    error.statusCode = 400;
    error.errorCode = 'DATABASE_ERROR';
    error.message = 'Error de base de datos';
    safeToExpose = true;
  } else if (err.isOperational) {
    // Errores operacionales (los que lanzamos a propósito: NotFound, Validation, Auth...)
    error.message = err.message;
    safeToExpose = true;
  }

  // Para errores NO seguros (inesperados), solo exponemos el mensaje real en desarrollo.
  // En producción, el cliente recibe el mensaje genérico "Error interno del servidor".
  if (!safeToExpose && process.env.NODE_ENV === 'development') {
    error.message = err.message || 'Error interno del servidor';
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.errorCode,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  });
};

module.exports = errorMiddleware;