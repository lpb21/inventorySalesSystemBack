/**
 * Product Image Service
 * Orquesta la imagen de un producto: subida del usuario, borrado y autocompletado
 * desde Open Food Facts. Siempre una sola imagen por producto en S3
 * (tenants/{tenantId}/products/{productId}.webp), que se sobrescribe al cambiarla.
 *
 * Reglas:
 * - Toda operación busca el producto con { id, tenant_id } ANTES de tocar S3.
 * - El autocompletado nunca sobrescribe una foto del usuario ('user') ni una imagen
 *   que el usuario quitó a propósito ('none'). La búsqueda manual (force) sí puede.
 * - El soft-delete del producto NO borra la imagen (el producto puede reactivarse).
 */
const { Product } = require('../models');
const { NotFoundError, AppError, ValidationError } = require('../utils/errors');
const storageService = require('./storageService');
const { processProductImage } = require('./imageService');
const openFoodFactsService = require('./openFoodFactsService');
const auditService = require('./auditService');
const cacheService = require('./cacheService');
const env = require('../config/env');
const logger = require('../utils/logger');

const STORED_SOURCES = ['user', 'off', 'generic'];
const MAX_QUEUE_SIZE = 5000;

class ProductImageService {
  constructor() {
    this.queue = [];
    this.queued = new Set();
    this.processing = false;
  }

  async findTenantProduct(tenantId, productId) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    return product;
  }

  ensureStorageConfigured() {
    if (!storageService.isConfigured()) {
      throw new AppError('El almacenamiento de imágenes no está configurado', 503, 'STORAGE_NOT_CONFIGURED');
    }
  }

  /**
   * Procesa y sube la imagen a la ruta fija del producto. Devuelve la URL versionada.
   */
  async storeImage(tenantId, productId, rawBuffer) {
    const processed = await processProductImage(rawBuffer);
    const key = storageService.productImageKey(tenantId, productId);
    await storageService.putObject(key, processed.buffer, processed.contentType);
    // ?v= fuerza a CloudFront/navegador a pedir la nueva versión tras un cambio
    return `${storageService.publicUrl(key)}?v=${Date.now()}`;
  }

  async deleteStoredImage(tenantId, productId) {
    if (!storageService.isConfigured()) return;
    const key = storageService.productImageKey(tenantId, productId);
    try {
      await storageService.deleteObject(key);
    } catch (error) {
      logger.warn('product-images', 'No se pudo borrar la imagen en S3', { key, error: error.message });
    }
  }

  async saveImageFields(tenantId, product, fields, userId) {
    const oldData = { image_url: product.image_url, image_source: product.image_source };

    await product.update(fields);

    await auditService.logProductUpdate({
      tenantId,
      userId,
      product,
      oldData,
      newData: { image_url: fields.image_url, image_source: fields.image_source },
    });

    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch((err) => {
      logger.warn('products', 'No se pudo invalidar caché de productos', { error: err.message });
    });

    return product;
  }

  /**
   * PUT /products/:id/image — foto propia del tenant (siempre gana)
   */
  async uploadUserImage(tenantId, productId, fileBuffer, userId) {
    const product = await this.findTenantProduct(tenantId, productId);
    this.ensureStorageConfigured();

    const imageUrl = await this.storeImage(tenantId, product.id, fileBuffer);

    return this.saveImageFields(tenantId, product, {
      image_url: imageUrl,
      image_source: 'user',
      image_source_ref: null,
    }, userId);
  }

  /**
   * DELETE /products/:id/image — quita la imagen y evita que se autocomplete de nuevo
   */
  async removeImage(tenantId, productId, userId) {
    const product = await this.findTenantProduct(tenantId, productId);

    if (STORED_SOURCES.includes(product.image_source)) {
      await this.deleteStoredImage(tenantId, product.id);
    }

    return this.saveImageFields(tenantId, product, {
      image_url: null,
      image_source: 'none',
      image_source_ref: null,
    }, userId);
  }

  /**
   * Cambios de image_url que llegan por PUT /products/:id (enlace manual).
   * Muta filteredData; el autocompletado lo decide enqueueIfNeeded() después de guardar.
   */
  async applyImageUrlChange(tenantId, product, filteredData) {
    if (!Object.prototype.hasOwnProperty.call(filteredData, 'image_url')) return;

    // No se guardan hotlinks a OFF: se descarta y se procesa por el flujo normal (cola)
    if (openFoodFactsService.isOpenFoodFactsUrl(filteredData.image_url)) {
      delete filteredData.image_url;
      return;
    }

    const newUrl = filteredData.image_url || null;
    if (newUrl === (product.image_url || null)) return;

    // La imagen almacenada deja de usarse: se borra para no dejar huérfanos
    if (STORED_SOURCES.includes(product.image_source)) {
      await this.deleteStoredImage(tenantId, product.id);
    }

    filteredData.image_url = newUrl;
    filteredData.image_source = newUrl ? null : 'none';
    filteredData.image_source_ref = null;
  }

  /**
   * Autocompletado desde Open Food Facts.
   * @param {object} opts.force - búsqueda manual: ignora imagen existente
   * @returns {Promise<{status: 'updated'|'skipped'|'not_found'|'unavailable', reason?: string, product?}>}
   */
  async enrichFromOpenFoodFacts(tenantId, productId, { force = false, userId = null } = {}) {
    const product = await this.findTenantProduct(tenantId, productId);

    const skipReason = this.getAutoSkipReason(product, { force });
    if (skipReason) return { status: 'skipped', reason: skipReason };

    let lookup;
    let rawImage;
    try {
      lookup = await openFoodFactsService.lookupByBarcode(product.barcode);
      if (!lookup.found || !lookup.imageUrl) {
        return { status: 'not_found', reason: lookup.reason || 'no_image' };
      }
      rawImage = await openFoodFactsService.downloadImage(lookup.imageUrl);
    } catch (error) {
      // OFF caído, lento o imagen inaccesible: no es un error del usuario
      logger.warn('product-images', 'Open Food Facts no disponible', { productId, error: error.message });
      return { status: 'unavailable', reason: 'off_unavailable' };
    }

    // Mientras se descargaba, el usuario pudo haber subido su propia foto
    await product.reload();
    const lateSkip = this.getAutoSkipReason(product, { force });
    if (lateSkip) return { status: 'skipped', reason: lateSkip };

    let imageUrl;
    try {
      imageUrl = await this.storeImage(tenantId, product.id, rawImage);
    } catch (error) {
      // Imagen de OFF corrupta o no soportada: no es un error del usuario
      if (error instanceof ValidationError) {
        logger.warn('product-images', 'Imagen de Open Food Facts inválida', { productId, error: error.message });
        return { status: 'unavailable', reason: 'invalid_image' };
      }
      throw error;
    }

    const updated = await this.saveImageFields(tenantId, product, {
      image_url: imageUrl,
      image_source: 'off',
      image_source_ref: lookup.sourceUrl,
    }, userId);

    return { status: 'updated', product: updated };
  }

  getAutoSkipReason(product, { force = false } = {}) {
    if (!openFoodFactsService.normalizeBarcode(product.barcode)) return 'no_barcode';
    if (!storageService.isConfigured()) return 'storage_not_configured';
    if (force) return null;
    if (product.image_source === 'user') return 'user_image';
    if (product.image_source === 'none') return 'removed_by_user';
    if (product.image_url) return 'has_image';
    return null;
  }

  /**
   * GET /products/lookup/:barcode — vista previa para el formulario de creación.
   * Devuelve la URL original de OFF solo para mostrarla; no se guarda como image_url.
   */
  async lookupBarcode(barcode) {
    const code = openFoodFactsService.normalizeBarcode(barcode);
    if (!code) {
      return { found: false, barcode: null, reason: 'invalid_barcode' };
    }

    try {
      const result = await openFoodFactsService.lookupByBarcode(code);
      if (!result.found) return result;
      return {
        ...result,
        attribution: result.imageUrl ? openFoodFactsService.ATTRIBUTION : null,
      };
    } catch (error) {
      // OFF caído o lento: el formulario sigue normal, sin autocompletar
      logger.warn('product-images', 'Open Food Facts no respondió', { barcode: code, error: error.message });
      return { found: false, barcode: code, reason: 'unavailable' };
    }
  }

  isAutoEnrichAvailable() {
    return env.openFoodFacts.enabled && storageService.isConfigured();
  }

  /**
   * Encola el autocompletado si el producto lo necesita. No bloquea al llamador.
   */
  enqueueIfNeeded(product) {
    if (!product || !this.isAutoEnrichAvailable()) return false;
    if (this.getAutoSkipReason(product)) return false;
    return this.enqueue(product.tenant_id, product.id);
  }

  enqueue(tenantId, productId) {
    const key = `${tenantId}:${productId}`;
    if (this.queued.has(key)) return false;
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.warn('product-images', 'Cola de imágenes llena, se omite', { tenantId, productId });
      return false;
    }

    this.queued.add(key);
    this.queue.push({ tenantId, productId, key });
    // Arranca el worker en segundo plano (el ritmo lo controla openFoodFactsService)
    setImmediate(() => this.drain());
    return true;
  }

  async drain() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        try {
          const result = await this.enrichFromOpenFoodFacts(job.tenantId, job.productId);
          logger.info('product-images', 'Autocompletado de imagen', {
            productId: job.productId, status: result.status, reason: result.reason,
          });
        } catch (error) {
          logger.warn('product-images', 'Falló el autocompletado de imagen', {
            productId: job.productId, error: error.message,
          });
        } finally {
          this.queued.delete(job.key);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  getQueueSize() {
    return this.queue.length;
  }
}

module.exports = new ProductImageService();
