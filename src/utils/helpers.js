/**
 * Utility Helpers
 * Common helper functions
 */

/**
 * Async handler wrapper
 * Catches async errors and passes to next middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Format success response
 */
const formatResponse = (data, pagination = null) => {
  const response = {
    success: true,
    data,
  };
  
  if (pagination) {
    response.pagination = pagination;
  }
  
  return response;
};

/**
 * Format error response
 */
const formatError = ({ message, statusCode = 500, errorCode = 'ERROR', details = null }) => {
  const error = {
    code: errorCode,
    message,
  };
  
  if (details) {
    error.details = details;
  }
  
  return {
    success: false,
    error,
  };
};

/**
 * Generate pagination metadata
 */
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Build pagination query
 */
const getPagination = (page = 1, limit = 20) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;
  
  return {
    limit: Math.min(limitNum, 100),
    offset,
    page: pageNum,
  };
};

/**
 * Generate UUID v4
 */
const { v4: uuidv4 } = require('uuid');

/**
 * Calculate percentage
 */
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return ((value / total) * 100).toFixed(2);
};

/**
 * Format currency
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
  }).format(amount);
};

/**
 * Get date range for queries
 */
const getDateRange = (period) => {
  const now = new Date();
  let startDate;
  let endDate = now;
  
  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      startDate = new Date(0); // All time
  }
  
  return { startDate, endDate };
};

/**
 * Get pagination skip value
 */
const getPaginationSkip = (page = 1, limit = 20) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  return (pageNum - 1) * limitNum;
};

/**
 * Format pagination response
 */
const formatPagination = (page = 1, limit = 20, total = 0) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const totalNum = parseInt(total) || 0;
  const totalPages = Math.ceil(totalNum / limitNum);
  
  return {
    page: pageNum,
    limit: limitNum,
    total: totalNum,
    totalPages,
    hasNextPage: pageNum < totalPages,
    hasPrevPage: pageNum > 1,
  };
};

module.exports = {
  asyncHandler,
  formatResponse,
  formatError,
  getPaginationMeta,
  getPagination,
  getPaginationSkip,
  formatPagination,
  uuidv4,
  calculatePercentage,
  formatCurrency,
  getDateRange,
};
