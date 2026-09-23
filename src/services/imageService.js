/**
 * Image Service
 * Normaliza cualquier imagen de producto a una sola versión: WebP cuadrado, fondo blanco.
 *
 * Pensado para una instancia pequeña (t3.micro, PM2 reinicia a los 400MB):
 * - sharp.concurrency(1) y sin caché de libvips para acotar memoria
 * - limitInputPixels rechaza "bombas" de descompresión
 * - un semáforo limita cuántas imágenes se procesan a la vez en el proceso
 */
const sharp = require('sharp');
const env = require('../config/env');
const { ValidationError } = require('../utils/errors');

sharp.concurrency(1);
sharp.cache(false);

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif', 'gif']);
const OUTPUT_CONTENT_TYPE = 'image/webp';
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Semáforo simple en memoria
let active = 0;
const waiting = [];

async function withSlot(fn) {
  if (active >= env.productImages.maxConcurrent) {
    await new Promise((resolve) => waiting.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waiting.shift();
    if (next) next();
  }
}

/**
 * Procesa un buffer de imagen y devuelve { buffer, contentType, width, height }.
 * Lanza ValidationError si el archivo no es una imagen válida o soportada.
 */
async function processProductImage(input, options = {}) {
  const size = options.size || env.productImages.size;
  const quality = options.quality || env.productImages.quality;
  const maxInputPixels = options.maxInputPixels || env.productImages.maxInputPixels;

  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new ValidationError('No se recibió ninguna imagen');
  }

  return withSlot(async () => {
    let metadata;
    try {
      // Lee la cabecera real del archivo (no confía en el mimetype enviado por el cliente)
      metadata = await sharp(input, { limitInputPixels: maxInputPixels }).metadata();
    } catch (error) {
      throw new ValidationError('El archivo no es una imagen válida');
    }

    if (!ALLOWED_FORMATS.has(metadata.format)) {
      throw new ValidationError('Formato de imagen no soportado. Usa JPG, PNG o WebP');
    }

    if (metadata.width && metadata.height && metadata.width * metadata.height > maxInputPixels) {
      throw new ValidationError('La imagen tiene una resolución demasiado grande');
    }

    try {
      const { data, info } = await sharp(input, { limitInputPixels: maxInputPixels, animated: false })
        .rotate() // aplica la orientación EXIF antes de descartar metadatos
        .resize(size, size, { fit: 'contain', background: WHITE }) // imagen completa, sin recortar
        .flatten({ background: WHITE }) // PNG/WebP con transparencia → fondo blanco
        .webp({ quality })
        .toBuffer({ resolveWithObject: true }); // sharp no copia EXIF/GPS a la salida

      return {
        buffer: data,
        contentType: OUTPUT_CONTENT_TYPE,
        width: info.width,
        height: info.height,
      };
    } catch (error) {
      throw new ValidationError('No se pudo procesar la imagen');
    }
  });
}

module.exports = {
  processProductImage,
  OUTPUT_CONTENT_TYPE,
};
