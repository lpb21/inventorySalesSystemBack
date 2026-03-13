/**
 * Error Middleware
 * Handles errors and returns proper JSON responses
 */
const { AppError } = require('../utils/errors');

const errorMiddleware = (err, req, res, next) => {
  // Log error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Default error
  let error = {
    message: err.message || 'Error interno del servidor',
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || 'INTERNAL_ERROR',
  };

  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    error.message = 'Error de validación';
    error.details = err.errors.map(e => e.message);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    error.statusCode = 409;
    error.errorCode = 'DUPLICATE_ERROR';
    error.message = 'El recurso ya existe';
    error.details = err.errors.map(e => e.message);
  }

  if (err.name === 'SequelizeDatabaseError') {
    error.statusCode = 400;
    error.errorCode = 'DATABASE_ERROR';
    error.message = 'Error de base de datos';
  }

  // Handle operational errors (known errors)
  if (err.isOperational) {
    error.message = err.message;
  }

  // Send response
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
