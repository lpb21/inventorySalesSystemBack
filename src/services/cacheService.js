/**
 * Cache Service
 * Maneja el cache con Redis para optimizar consultas a la base de datos
 */
const redis = require('redis');
const env = require('../config/env');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.disabled = process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false';
  }

  /**
   * Inicializa la conexion con Redis
   */
  async connect() {
    if (this.disabled) return;
    if (this.client && this.isConnected) {
      return;
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.isConnected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    try {
      this.client = redis.createClient({
        url: env.redis.url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.warn('redis', 'Max reconnection attempts reached');
              return new Error('Redis connection failed');
            }

            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        logger.error('redis', 'Client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('redis', 'Connected', { url: env.redis.url });
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('redis', 'Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('redis', 'Failed to connect', { error: error.message, url: env.redis.url });
      this.isConnected = false;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Obtiene un valor del cache
   * @param {string} key - Clave del cache
   * @returns {Promise<object|null>} - Valor cacheado o null
   */
  async get(key) {
    if (this.disabled) return null;
    const result = await this.getWithMeta(key);
    return result.value;
  }

  /**
   * Obtiene un valor del cache con metadatos del resultado
   * @param {string} key - Clave del cache
   * @returns {Promise<{value: object|null, hit: boolean}>}
   */
  async getWithMeta(key) {
    if (this.disabled) return { value: null, hit: false };
    if (!this.isConnected || !this.client) {
      try {
        await Promise.race([
          this.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2000)),
        ]);
      } catch (error) {
        logger.warn('redis', 'Cache unavailable, skipping read', { key, reason: error.message });
        return { value: null, hit: false };
      }
    }

    if (!this.isConnected) {
      logger.warn('redis', 'Cache unavailable, skipping read', { key });
      return { value: null, hit: false };
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        logger.info('redis', 'Cache hit', { key });
        return { value: JSON.parse(value), hit: true };
      }

      logger.info('redis', 'Cache miss', { key });
      return { value: null, hit: false };
    } catch (error) {
      logger.error('redis', 'Error reading cache', { key, error: error.message });
      return { value: null, hit: false };
    }
  }

  /**
   * Guarda un valor en el cache
   * @param {string} key - Clave del cache
   * @param {object} value - Valor a guardar
   * @param {number} ttl - Tiempo de vida en segundos (opcional)
   */
  async set(key, value, ttl = null) {
    if (this.disabled) return;
    if (!this.isConnected || !this.client) {
      try {
        await Promise.race([
          this.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2000)),
        ]);
      } catch (error) {
        logger.warn('redis', 'Cache unavailable, skipping write', { key, reason: error.message });
        return;
      }
    }

    if (!this.isConnected) {
      logger.warn('redis', 'Cache unavailable, skipping write', { key });
      return;
    }

    const expirationTime = ttl || env.redis.ttl;

    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: expirationTime,
      });
      logger.info('redis', 'Cache set', { key, ttl: `${expirationTime}s` });
    } catch (error) {
      logger.error('redis', 'Error writing cache', { key, error: error.message });
    }
  }

  /**
   * Invalidar claves de cache por patron usando SCAN
   * @param {string} pattern - Patron de las claves a invalidar
   */
  async invalidate(pattern) {
    if (this.disabled) return;
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      let deletedCount = 0;

      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        await this.client.del(key);
        deletedCount++;
      }

      if (deletedCount > 0) {
        logger.info('redis', 'Cache invalidated by pattern', { pattern, deletedCount });
      }
    } catch (error) {
      logger.error('redis', 'Error invalidating by pattern', { pattern, error: error.message });
    }
  }

  /**
   * Invalidar multiples claves especificas
   * @param {string[]} keys - Array de claves a invalidar
   */
  async invalidateKeys(keys) {
    if (this.disabled) return;
    if (!this.isConnected || !this.client || !keys.length) {
      return;
    }

    try {
      await this.client.del(keys);
      logger.info('redis', 'Cache invalidated by keys', { keys: keys.join(', ') });
    } catch (error) {
      logger.error('redis', 'Error invalidating keys', { keys: keys.join(', '), error: error.message });
    }
  }

  /**
   * Genera una clave de cache para balance de cliente
   */
  getCustomerBalanceKey(tenantId, customerId) {
    return `customer:balance:${tenantId}:${customerId}`;
  }

  /**
   * Genera una clave de cache para ventas a credito de cliente
   */
  getCustomerCreditSalesKey(tenantId, customerId, page = 1, limit = 20) {
    return `customer:credit-sales:${tenantId}:${customerId}:${page}:${limit}`;
  }

  /**
   * Genera el patron para invalidar todas las ventas a credito de un cliente
   */
  getCustomerCreditSalesPattern(tenantId, customerId) {
    return `customer:credit-sales:${tenantId}:${customerId}:*`;
  }

  /**
   * Genera una clave de cache para la lista de clientes con credito
   */
  getCustomersWithCreditKey(tenantId, page = 1, limit = 20) {
    return `customer:with-credit:${tenantId}:${page}:${limit}`;
  }

  /**
   * Genera el patron para invalidar todas las listas de deudores de un inquilino
   */
  getCustomersWithCreditPattern(tenantId) {
    return `customer:with-credit:${tenantId}:*`;
  }

  /**
   * Genera una clave de cache para la lista de productos de un tenant
   */
  getProductsKey(tenantId, page = 1, limit = 20, filters = '') {
    return `products:list:${tenantId}:${page}:${limit}:${filters}`;
  }

  /**
   * Genera el patron para invalidar todas las listas de productos de un tenant
   */
  getProductsPattern(tenantId) {
    return `products:list:${tenantId}:*`;
  }

  /**
   * Genera una clave de cache para el dashboard de un tenant
   */
  getDashboardKey(tenantId) {
    return `dashboard:${tenantId}`;
  }

  /**
   * Cierra la conexion con Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

module.exports = new CacheService();
