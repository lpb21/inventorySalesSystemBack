// S3 y Open Food Facts simulados: los tests nunca salen a internet ni tocan AWS
jest.mock('../src/services/storageService', () => ({
  isConfigured: jest.fn(() => true),
  productImageKey: jest.fn((tenantId, productId) => `tenants/${tenantId}/products/${productId}.webp`),
  publicUrl: jest.fn((key) => `https://cdn.test/${key}`),
  putObject: jest.fn(async () => {}),
  deleteObject: jest.fn(async () => {}),
}));

jest.mock('../src/services/openFoodFactsService', () => {
  const actual = jest.requireActual('../src/services/openFoodFactsService');
  return {
    ...actual,
    lookupByBarcode: jest.fn(),
    downloadImage: jest.fn(),
  };
});

const sharp = require('sharp');
const db = require('../src/models');
const { Product } = db;
const storageService = require('../src/services/storageService');
const openFoodFactsService = require('../src/services/openFoodFactsService');
const productImageService = require('../src/services/productImageService');
const productService = require('../src/services/productService');
const { resetDb } = require('./dbSetup');
const { createTenant } = require('./helpers');

const BARCODE = '7702004003508';
const OFF_IMAGE_URL = 'https://images.openfoodfacts.org/images/products/770/200/400/3508/front_es.3.400.jpg';

let photo;

beforeAll(async () => {
  photo = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 220, g: 40, b: 40 } },
  }).jpeg().toBuffer();
});

beforeEach(async () => {
  await resetDb();
  jest.clearAllMocks();
  storageService.isConfigured.mockReturnValue(true);
  // Que la respuesta simulada de OFF de un test no se filtre al siguiente
  openFoodFactsService.lookupByBarcode.mockReset();
  openFoodFactsService.downloadImage.mockReset();
});

afterAll(async () => {
  await db.sequelize.close();
});

function offFoundWithImage() {
  openFoodFactsService.lookupByBarcode.mockResolvedValue({
    found: true,
    barcode: BARCODE,
    name: 'Gaseosa',
    brand: 'Marca',
    imageUrl: OFF_IMAGE_URL,
    sourceUrl: `https://world.openfoodfacts.org/product/${BARCODE}`,
  });
  openFoodFactsService.downloadImage.mockResolvedValue(photo);
}

describe('Subida de imagen propia (PUT /products/:id/image)', () => {
  test('procesa a WebP, sube a la ruta fija del tenant y marca image_source = user', async () => {
    const { tenant, owner, product } = await createTenant('A');

    const updated = await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);

    const expectedKey = `tenants/${tenant.id}/products/${product.id}.webp`;
    expect(storageService.putObject).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = storageService.putObject.mock.calls[0];
    expect(key).toBe(expectedKey);
    expect(contentType).toBe('image/webp');

    const meta = await sharp(body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);

    expect(updated.image_url).toMatch(new RegExp(`^https://cdn\\.test/${expectedKey}\\?v=\\d+$`));
    expect(updated.image_source).toBe('user');
    expect(updated.image_source_ref).toBeNull();

    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.image_source).toBe('user');
  });

  test('cambiar la foto sobrescribe la misma clave (no se acumulan archivos)', async () => {
    const { tenant, owner, product } = await createTenant('A');

    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);
    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);

    const keys = storageService.putObject.mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(1);
  });

  test('un tenant NO puede subir imagen al producto de otro tenant (no toca S3)', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      productImageService.uploadUserImage(a.tenant.id, b.product.id, photo, a.owner.id)
    ).rejects.toThrow(/no encontrado/i);

    expect(storageService.putObject).not.toHaveBeenCalled();
    const untouched = await Product.findByPk(b.product.id);
    expect(untouched.image_url).toBeNull();
    expect(untouched.image_source).toBeNull();
  });

  test('un archivo que no es imagen se rechaza y no se sube nada', async () => {
    const { tenant, owner, product } = await createTenant('A');

    await expect(
      productImageService.uploadUserImage(tenant.id, product.id, Buffer.from('%PDF-1.4 falso'), owner.id)
    ).rejects.toThrow(/no es una imagen válida/i);

    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  test('sin S3 configurado responde 503 y no procesa la imagen', async () => {
    const { tenant, owner, product } = await createTenant('A');
    storageService.isConfigured.mockReturnValue(false);

    await expect(
      productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id)
    ).rejects.toMatchObject({ statusCode: 503, errorCode: 'STORAGE_NOT_CONFIGURED' });

    expect(storageService.putObject).not.toHaveBeenCalled();
  });
});

describe('Quitar imagen (DELETE /products/:id/image)', () => {
  test('borra el archivo de S3 y marca image_source = none', async () => {
    const { tenant, owner, product } = await createTenant('A');
    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);

    const updated = await productImageService.removeImage(tenant.id, product.id, owner.id);

    expect(storageService.deleteObject).toHaveBeenCalledWith(`tenants/${tenant.id}/products/${product.id}.webp`);
    expect(updated.image_url).toBeNull();
    expect(updated.image_source).toBe('none');
  });

  test('un enlace externo (sin archivo propio) no llama a S3 al quitarlo', async () => {
    const { tenant, owner, product } = await createTenant('A');
    await product.update({ image_url: 'https://ejemplo.com/foto.jpg' });

    await productImageService.removeImage(tenant.id, product.id, owner.id);

    expect(storageService.deleteObject).not.toHaveBeenCalled();
  });

  test('un tenant NO puede quitar la imagen del producto de otro tenant', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');
    await productImageService.uploadUserImage(b.tenant.id, b.product.id, photo, b.owner.id);
    jest.clearAllMocks();

    await expect(
      productImageService.removeImage(a.tenant.id, b.product.id, a.owner.id)
    ).rejects.toThrow(/no encontrado/i);

    expect(storageService.deleteObject).not.toHaveBeenCalled();
    const untouched = await Product.findByPk(b.product.id);
    expect(untouched.image_source).toBe('user');
  });

  test('el soft-delete del producto NO borra la imagen (puede reactivarse)', async () => {
    const { tenant, owner, product } = await createTenant('A');
    await product.update({ stock: 0 });
    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);
    const imageUrl = (await Product.findByPk(product.id)).image_url;

    await productService.deleteProduct(tenant.id, product.id, owner.id);

    expect(storageService.deleteObject).not.toHaveBeenCalled();
    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.is_active).toBe(false);
    expect(fromDb.image_url).toBe(imageUrl);
    expect(fromDb.image_source).toBe('user');
  });
});

describe('Autocompletado desde Open Food Facts', () => {
  test('producto con código de barras y sin imagen: guarda la imagen procesada con atribución', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE });
    offFoundWithImage();

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result.status).toBe('updated');
    expect(openFoodFactsService.downloadImage).toHaveBeenCalledWith(OFF_IMAGE_URL);
    expect(storageService.putObject).toHaveBeenCalledTimes(1);

    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.image_source).toBe('off');
    expect(fromDb.image_source_ref).toBe(`https://world.openfoodfacts.org/product/${BARCODE}`);
    // Se guarda la copia en nuestro S3, nunca el hotlink de OFF
    expect(fromDb.image_url).toMatch(/^https:\/\/cdn\.test\//);
  });

  test('NUNCA sobrescribe automáticamente una foto del usuario', async () => {
    const { tenant, owner, product } = await createTenant('A');
    await product.update({ barcode: BARCODE });
    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);
    jest.clearAllMocks();
    offFoundWithImage();

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result).toEqual({ status: 'skipped', reason: 'user_image' });
    expect(openFoodFactsService.lookupByBarcode).not.toHaveBeenCalled();
    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  test('no autocompleta si el usuario quitó la imagen a propósito', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE, image_source: 'none' });
    offFoundWithImage();

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result).toEqual({ status: 'skipped', reason: 'removed_by_user' });
    expect(openFoodFactsService.lookupByBarcode).not.toHaveBeenCalled();
  });

  test('la búsqueda manual (force) sí reemplaza la imagen', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE, image_source: 'none' });
    offFoundWithImage();

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id, { force: true });

    expect(result.status).toBe('updated');
    expect((await Product.findByPk(product.id)).image_source).toBe('off');
  });

  test('si el usuario sube su foto mientras se descargaba la de OFF, gana la del usuario', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE });
    openFoodFactsService.lookupByBarcode.mockResolvedValue({
      found: true, barcode: BARCODE, imageUrl: OFF_IMAGE_URL, sourceUrl: 'https://world.openfoodfacts.org/product/x',
    });
    openFoodFactsService.downloadImage.mockImplementation(async () => {
      // Carrera: llega la foto del usuario durante la descarga
      await Product.update(
        { image_url: 'https://cdn.test/propia.webp', image_source: 'user' },
        { where: { id: product.id } }
      );
      return photo;
    });

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result).toEqual({ status: 'skipped', reason: 'user_image' });
    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  test('sin código de barras (p. ej. fruta por peso) se omite sin llamar a OFF', async () => {
    const { tenant, product } = await createTenant('A');

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result).toEqual({ status: 'skipped', reason: 'no_barcode' });
    expect(openFoodFactsService.lookupByBarcode).not.toHaveBeenCalled();
  });

  test('OFF sin el producto: not_found y no sube nada', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE });
    openFoodFactsService.lookupByBarcode.mockResolvedValue({ found: false, barcode: BARCODE, reason: 'not_found' });

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result).toEqual({ status: 'not_found', reason: 'not_found' });
    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  test('OFF caído: unavailable, sin error hacia el usuario', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE });
    openFoodFactsService.lookupByBarcode.mockRejectedValue(new Error('timeout of 3000ms exceeded'));

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id);

    expect(result).toEqual({ status: 'unavailable', reason: 'off_unavailable' });
  });

  test('imagen de OFF corrupta: unavailable, no sube nada ni responde 400 al usuario', async () => {
    const { tenant, product } = await createTenant('A');
    await product.update({ barcode: BARCODE });
    offFoundWithImage();
    openFoodFactsService.downloadImage.mockResolvedValue(Buffer.from('<html>no es imagen</html>'));

    const result = await productImageService.enrichFromOpenFoodFacts(tenant.id, product.id, { force: true });

    expect(result).toEqual({ status: 'unavailable', reason: 'invalid_image' });
    expect(storageService.putObject).not.toHaveBeenCalled();
    expect((await Product.findByPk(product.id)).image_source).toBeNull();
  });

  test('un tenant NO puede disparar la búsqueda sobre el producto de otro tenant', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');
    await b.product.update({ barcode: BARCODE });
    offFoundWithImage();

    await expect(
      productImageService.enrichFromOpenFoodFacts(a.tenant.id, b.product.id, { force: true })
    ).rejects.toThrow(/no encontrado/i);

    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  test('la cola no se activa cuando OFF está desactivado (entorno de tests)', async () => {
    const { product } = await createTenant('A');
    await product.update({ barcode: BARCODE });

    expect(productImageService.enqueueIfNeeded(product)).toBe(false);
    expect(productImageService.getQueueSize()).toBe(0);
  });
});

describe('Vista previa por código de barras (GET /products/lookup/:barcode)', () => {
  test('encontrado: incluye la atribución CC BY-SA', async () => {
    offFoundWithImage();

    const result = await productImageService.lookupBarcode(BARCODE);

    expect(result.found).toBe(true);
    expect(result.attribution).toEqual(openFoodFactsService.ATTRIBUTION);
  });

  test('código inválido: no consulta OFF', async () => {
    const result = await productImageService.lookupBarcode('PAPA-KG');

    expect(result).toEqual({ found: false, barcode: null, reason: 'invalid_barcode' });
    expect(openFoodFactsService.lookupByBarcode).not.toHaveBeenCalled();
  });

  test('OFF caído: el formulario sigue sin autocompletar', async () => {
    openFoodFactsService.lookupByBarcode.mockRejectedValue(new Error('ECONNRESET'));

    const result = await productImageService.lookupBarcode(BARCODE);

    expect(result).toEqual({ found: false, barcode: BARCODE, reason: 'unavailable' });
  });
});

describe('skip_image_lookup (el front sube foto propia tras crear/editar)', () => {
  const env = require('../src/config/env');
  let enqueueSpy;

  beforeEach(() => {
    env.openFoodFacts.enabled = true;
    // Espía sin ejecutar la cola real (nada sale a internet)
    enqueueSpy = jest.spyOn(productImageService, 'enqueue').mockReturnValue(true);
  });

  afterEach(() => {
    env.openFoodFacts.enabled = false;
    enqueueSpy.mockRestore();
  });

  const newProduct = (extra = {}) => ({
    name: 'Gaseosa', unit: 'und', price: 3000, cost: 2000, stock: 5, min_stock: 1,
    barcode: '7702004003591', ...extra,
  });

  test('sin el flag, crear con código de barras encola la búsqueda en OFF', async () => {
    const { tenant, owner } = await createTenant('A');

    await productService.createProduct(tenant.id, newProduct(), owner.id);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  test('con el flag, crear NO encola (evita competir con la subida del usuario)', async () => {
    const { tenant, owner } = await createTenant('A');

    const product = await productService.createProduct(tenant.id, newProduct({ skip_image_lookup: true }), owner.id);

    expect(enqueueSpy).not.toHaveBeenCalled();
    // El flag no es una columna: no debe romper ni persistirse
    expect(product.get('skip_image_lookup')).toBeUndefined();
  });

  test('con el flag, editar NO encola', async () => {
    const { tenant, owner, product } = await createTenant('A');

    await productService.updateProduct(tenant.id, product.id, { barcode: '7702004003591', skip_image_lookup: true }, owner.id);

    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  test('sin el flag, editar agregando código de barras encola', async () => {
    const { tenant, owner, product } = await createTenant('A');

    await productService.updateProduct(tenant.id, product.id, { barcode: '7702004003591' }, owner.id);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Integración con productService', () => {
  test('createProduct no guarda hotlinks de OFF ni acepta image_source del cliente', async () => {
    const { tenant, owner } = await createTenant('A');

    const product = await productService.createProduct(tenant.id, {
      name: 'Gaseosa', unit: 'und', price: 3000, cost: 2000, stock: 5, min_stock: 1,
      barcode: '7702004003591',
      image_url: OFF_IMAGE_URL,
      image_source: 'user',
      image_source_ref: 'trampa',
    }, owner.id);

    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.image_url).toBeNull();
    expect(fromDb.image_source).toBeNull();
    expect(fromDb.image_source_ref).toBeNull();
  });

  test('updateProduct con otro image_url manual borra la imagen almacenada y limpia el origen', async () => {
    const { tenant, owner, product } = await createTenant('A');
    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);
    jest.clearAllMocks();

    await productService.updateProduct(tenant.id, product.id, { image_url: 'https://ejemplo.com/otra.jpg' }, owner.id);

    expect(storageService.deleteObject).toHaveBeenCalledWith(`tenants/${tenant.id}/products/${product.id}.webp`);
    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.image_url).toBe('https://ejemplo.com/otra.jpg');
    expect(fromDb.image_source).toBeNull();
  });

  test('updateProduct con image_url vacío equivale a quitarla (no se autocompleta luego)', async () => {
    const { tenant, owner, product } = await createTenant('A');
    await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);

    await productService.updateProduct(tenant.id, product.id, { image_url: '' }, owner.id);

    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.image_url).toBeNull();
    expect(fromDb.image_source).toBe('none');
  });

  test('updateProduct con el mismo image_url no toca S3', async () => {
    const { tenant, owner, product } = await createTenant('A');
    const updated = await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);
    jest.clearAllMocks();

    await productService.updateProduct(tenant.id, product.id, { image_url: updated.image_url, price: 1500 }, owner.id);

    expect(storageService.deleteObject).not.toHaveBeenCalled();
    expect((await Product.findByPk(product.id)).image_source).toBe('user');
  });

  test('updateProduct ignora un hotlink de OFF y conserva la imagen actual', async () => {
    const { tenant, owner, product } = await createTenant('A');
    const updated = await productImageService.uploadUserImage(tenant.id, product.id, photo, owner.id);

    await productService.updateProduct(tenant.id, product.id, { image_url: OFF_IMAGE_URL }, owner.id);

    const fromDb = await Product.findByPk(product.id);
    expect(fromDb.image_url).toBe(updated.image_url);
    expect(fromDb.image_source).toBe('user');
  });
});
