/**
 * Cache Service
 * Maneja el caché con Redis para optimizar consultas a la base de datos
 */
const redis = require('redis');
const env = require('../config/env');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Inicializa la conexión con Redis
   */
  async connect() {
    if (this.client && this.isConnected) {
      return;
    }

    if (this.isConnecting) {
      // Esperar a que termine la conexión en progreso
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
              console.warn('Redis: Max reconnection attempts reached');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis: Connected successfully');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis: Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Redis: Failed to connect:', error.message);
      this.isConnected = false;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Obtiene un valor del caché
   * @param {string} key - Clave del caché
   * @returns {Promise<object|null>} - Valor cacheado o null
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }

    if (!this.isConnected) {
      console.warn('Redis: Cache unavailable, skipping cache read');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        console.log(`Redis: Cache HIT for key: ${key}`);
        return JSON.parse(value);
      }
      console.log(`Redis: Cache MISS for key: ${key}`);
      return null;
    } catch (error) {
      console.error('Redis: Error getting cache:', error.message);
      return null;
    }
  }

  /**
   * Guarda un valor en el caché
   * @param {string} key - Clave del caché
   * @param {object} value - Valor a guardar
   * @param {number} ttl - Tiempo de vida en segundos (opcional)
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }

    if (!this.isConnected) {
      console.warn('Redis: Cache unavailable, skipping cache write');
      return;
    }

    const expirationTime = ttl || env.redis.ttl;

    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: expirationTime,
      });
      console.log(`Redis: Cache SET for key: ${key} (TTL: ${expirationTime}s)`);
    } catch (error) {
      console.error('Redis: Error setting cache:', error.message);
    }
  }

  /**
   * Invalidar claves de caché por patrón
   * @param {string} pattern - Patrón de las claves a invalidar
   */
  async invalidate(pattern) {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`Redis: Cache invalidated for pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      console.error('Redis: Error invalidating cache:', error.message);
    }
  }

  /**
   * Invalidar múltiples claves específicas
   * @param {string[]} keys - Array de claves a invalidar
   */
  async invalidateKeys(keys) {
    if (!this.isConnected || !this.client || !keys.length) {
      return;
    }

    try {
      await this.client.del(keys);
      console.log(`Redis: Cache invalidated for keys: ${keys.join(', ')}`);
    } catch (error) {
      console.error('Redis: Error invalidating cache keys:', error.message);
    }
  }

  /**
   * Genera una clave de caché para balance de cliente
   */
  getCustomerBalanceKey(tenantId, customerId) {
    return `customer:balance:${tenantId}:${customerId}`;
  }

  /**
   * Genera una clave de caché para ventas a crédito de cliente
   */
  getCustomerCreditSalesKey(tenantId, customerId, page = 1, limit = 20) {
    return `customer:credit-sales:${tenantId}:${customerId}:${page}:${limit}`;
  }

  /**
   * Genera el patrón para invalidar todas las ventas a crédito de un cliente
   */
  getCustomerCreditSalesPattern(tenantId, customerId) {
    return `customer:credit-sales:${tenantId}:${customerId}:*`;
  }

  /**
   * Genera una clave de caché para la lista de clientes con crédito (deudores)
   */
  getCustomersWithCreditKey(tenantId, page = 1, limit = 20) {
    return `customer:with-credit:${tenantId}:${page}:${limit}`;
  }

  /**
   * Genera el patrón para invalidar todas las listas de deudores de un inquilino
   */
  getCustomersWithCreditPattern(tenantId) {
    return `customer:with-credit:${tenantId}:*`;
  }

  /**
   * Cierra la conexión con Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

module.exports = new CacheService();
