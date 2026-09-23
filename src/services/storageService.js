/**
 * Storage Service
 * Envoltorio mínimo sobre S3 para las imágenes de productos.
 * Las credenciales salen de la cadena por defecto del SDK (rol IAM de la instancia).
 */
const env = require('../config/env');

// Las imágenes se versionan con ?v= en la URL, así que el objeto puede cachearse "para siempre"
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

class StorageService {
  constructor() {
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.storage.s3Bucket);
  }

  getClient() {
    if (!this.client) {
      // require perezoso: el SDK solo se carga si de verdad se usa S3
      const { S3Client } = require('@aws-sdk/client-s3');
      this.client = new S3Client({ region: env.storage.s3Region });
    }
    return this.client;
  }

  /**
   * Clave determinística: una sola imagen por producto, se sobrescribe al cambiarla
   */
  productImageKey(tenantId, productId) {
    return `${env.storage.keyPrefix}/${tenantId}/products/${productId}.webp`;
  }

  publicUrl(key) {
    const base = env.storage.publicBaseUrl
      || `https://${env.storage.s3Bucket}.s3.${env.storage.s3Region}.amazonaws.com`;
    return `${base}/${key}`;
  }

  async putObject(key, body, contentType) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await this.getClient().send(new PutObjectCommand({
      Bucket: env.storage.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    }));
  }

  async deleteObject(key) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.getClient().send(new DeleteObjectCommand({
      Bucket: env.storage.s3Bucket,
      Key: key,
    }));
  }
}

module.exports = new StorageService();
