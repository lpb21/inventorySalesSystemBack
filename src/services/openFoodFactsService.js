/**
 * Open Food Facts Service
 * Búsqueda de datos e imagen de un producto por código de barras.
 *
 * - Nunca se usa en el flujo de venta: solo al crear/importar productos o a pedido.
 * - Caché GLOBAL (no por tenant): un código de barras es el mismo en todas las tiendas.
 *   Se cachean también los "no encontrado"; los errores (timeout, 5xx) NO se cachean.
 * - Ritmo limitado en el proceso para respetar el límite de OFF (~100 req/min por IP).
 * - Las imágenes de OFF son CC BY-SA: quien las guarde debe marcar image_source = 'off'.
 */
const axios = require('axios');
const env = require('../config/env');
const cacheService = require('./cacheService');

const BARCODE_REGEX = /^\d{8,14}$/;
const ALLOWED_IMAGE_HOSTS = ['images.openfoodfacts.org', 'static.openfoodfacts.org'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MEMORY_CACHE_MAX = 1000;
const FIELDS = 'code,product_name,product_name_es,brands,image_front_url,image_url';

const ATTRIBUTION = {
  text: 'Imagen: Open Food Facts contributors',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
};

// Respaldo en memoria por si Redis no está disponible
const memoryCache = new Map();

// Cola de ritmo: cada petición espera a que pase minIntervalMs desde la anterior
let nextSlotAt = 0;

async function throttle() {
  const now = Date.now();
  const waitMs = Math.max(0, nextSlotAt - now);
  nextSlotAt = Math.max(now, nextSlotAt) + env.openFoodFacts.minIntervalMs;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function normalizeBarcode(barcode) {
  if (barcode === undefined || barcode === null) return null;
  const clean = String(barcode).trim().replace(/[\s-]/g, '');
  return BARCODE_REGEX.test(clean) ? clean : null;
}

function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * true si la URL apunta a Open Food Facts (para no guardar hotlinks en image_url)
 */
function isOpenFoodFactsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    return /(^|\.)openfoodfacts\.org$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function cacheKey(barcode) {
  return `off:barcode:${barcode}`;
}

async function readCache(barcode) {
  const key = cacheKey(barcode);
  const cached = await cacheService.get(key).catch(() => null);
  if (cached) return cached;

  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > Date.now()) return mem.value;
  if (mem) memoryCache.delete(key);
  return null;
}

async function writeCache(barcode, value) {
  const key = cacheKey(barcode);
  const ttl = env.openFoodFacts.cacheTtlSeconds;

  await cacheService.set(key, value, ttl).catch(() => {});

  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    // Descarta la entrada más antigua (orden de inserción del Map)
    memoryCache.delete(memoryCache.keys().next().value);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}

function mapProduct(barcode, product) {
  const imageUrl = product.image_front_url || product.image_url || null;
  return {
    found: true,
    barcode,
    name: product.product_name_es || product.product_name || null,
    brand: product.brands ? String(product.brands).split(',')[0].trim() : null,
    imageUrl: imageUrl && isAllowedImageUrl(imageUrl) ? imageUrl : null,
    sourceUrl: `${env.openFoodFacts.baseUrl}/product/${barcode}`,
  };
}

/**
 * Busca un producto por código de barras.
 * @returns {Promise<{found: boolean, barcode: string|null, name?, brand?, imageUrl?, sourceUrl?}>}
 * @throws Error si OFF no responde (timeout, red, 5xx) — el llamador decide cómo degradar
 */
async function lookupByBarcode(barcode) {
  const code = normalizeBarcode(barcode);
  if (!code) {
    return { found: false, barcode: null, reason: 'invalid_barcode' };
  }

  if (!env.openFoodFacts.enabled) {
    return { found: false, barcode: code, reason: 'disabled' };
  }

  const cached = await readCache(code);
  if (cached) return cached;

  await throttle();

  const response = await axios.get(`${env.openFoodFacts.baseUrl}/api/v2/product/${code}`, {
    params: { fields: FIELDS },
    headers: { 'User-Agent': env.openFoodFacts.userAgent, Accept: 'application/json' },
    timeout: env.openFoodFacts.timeoutMs,
    // 404 = producto inexistente en OFF (respuesta válida, se cachea)
    validateStatus: (status) => status === 200 || status === 404,
  });

  const body = response.data || {};
  const result = response.status === 200 && body.status === 1 && body.product
    ? mapProduct(code, body.product)
    : { found: false, barcode: code, reason: 'not_found' };

  await writeCache(code, result);
  return result;
}

/**
 * Descarga la imagen de OFF (solo hosts permitidos, tamaño acotado).
 */
async function downloadImage(url) {
  if (!isAllowedImageUrl(url)) {
    throw new Error('URL de imagen no permitida');
  }

  await throttle();

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': env.openFoodFacts.userAgent },
    timeout: env.openFoodFacts.timeoutMs * 2,
    maxContentLength: MAX_IMAGE_BYTES,
    maxRedirects: 0,
  });

  return Buffer.from(response.data);
}

// Solo para tests
function _resetForTests() {
  memoryCache.clear();
  nextSlotAt = 0;
}

module.exports = {
  lookupByBarcode,
  downloadImage,
  normalizeBarcode,
  isAllowedImageUrl,
  isOpenFoodFactsUrl,
  ATTRIBUTION,
  _resetForTests,
};
