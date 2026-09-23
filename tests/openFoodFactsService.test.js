jest.mock('axios');

const axios = require('axios');
const env = require('../src/config/env');
const off = require('../src/services/openFoodFactsService');

const originalOff = { ...env.openFoodFacts };

beforeAll(() => {
  // En tests OFF viene apagado; lo encendemos contra el axios simulado y sin esperas
  env.openFoodFacts.enabled = true;
  env.openFoodFacts.minIntervalMs = 0;
});

afterAll(() => {
  Object.assign(env.openFoodFacts, originalOff);
});

beforeEach(() => {
  jest.clearAllMocks();
  off._resetForTests();
});

function offFound(product) {
  return { status: 200, data: { status: 1, product } };
}

describe('openFoodFactsService.normalizeBarcode', () => {
  test('acepta EAN-8, UPC-A, EAN-13 y GTIN-14, limpiando espacios y guiones', () => {
    expect(off.normalizeBarcode('12345670')).toBe('12345670');
    expect(off.normalizeBarcode('012345678905')).toBe('012345678905');
    expect(off.normalizeBarcode(' 7702004-003508 ')).toBe('7702004003508');
    expect(off.normalizeBarcode('17702004003505')).toBe('17702004003505');
  });

  test('rechaza códigos internos, cortos o con letras', () => {
    expect(off.normalizeBarcode('ABC123')).toBeNull();
    expect(off.normalizeBarcode('1234')).toBeNull();
    expect(off.normalizeBarcode('')).toBeNull();
    expect(off.normalizeBarcode(null)).toBeNull();
    expect(off.normalizeBarcode('123456789012345')).toBeNull();
  });
});

describe('openFoodFactsService.lookupByBarcode', () => {
  test('producto encontrado: devuelve nombre, marca, imagen y URL de origen', async () => {
    axios.get.mockResolvedValueOnce(offFound({
      product_name: 'Gaseosa',
      product_name_es: 'Gaseosa sabor cola',
      brands: 'Marca X, Marca Y',
      image_front_url: 'https://images.openfoodfacts.org/images/products/770/200/400/3508/front_es.3.400.jpg',
    }));

    const result = await off.lookupByBarcode('7702004003508');

    expect(result).toEqual({
      found: true,
      barcode: '7702004003508',
      name: 'Gaseosa sabor cola',
      brand: 'Marca X',
      imageUrl: 'https://images.openfoodfacts.org/images/products/770/200/400/3508/front_es.3.400.jpg',
      sourceUrl: `${env.openFoodFacts.baseUrl}/product/7702004003508`,
    });

    const [url, config] = axios.get.mock.calls[0];
    expect(url).toBe(`${env.openFoodFacts.baseUrl}/api/v2/product/7702004003508`);
    expect(config.headers['User-Agent']).toBe(env.openFoodFacts.userAgent);
    expect(config.timeout).toBe(env.openFoodFacts.timeoutMs);
  });

  test('producto inexistente (404): not_found y se cachea', async () => {
    axios.get.mockResolvedValueOnce({ status: 404, data: { status: 0 } });

    const first = await off.lookupByBarcode('7700000000017');
    const second = await off.lookupByBarcode('7700000000017');

    expect(first).toEqual({ found: false, barcode: '7700000000017', reason: 'not_found' });
    expect(second).toEqual(first);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('un resultado encontrado también se cachea (una sola llamada a OFF)', async () => {
    axios.get.mockResolvedValueOnce(offFound({ product_name: 'Leche' }));

    await off.lookupByBarcode('7702001000019');
    await off.lookupByBarcode('7702001000019');

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('código inválido: no llama a OFF', async () => {
    const result = await off.lookupByBarcode('TOMATE-01');

    expect(result).toEqual({ found: false, barcode: null, reason: 'invalid_barcode' });
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('OFF desactivado: no llama a la API', async () => {
    env.openFoodFacts.enabled = false;
    try {
      const result = await off.lookupByBarcode('7702004003508');
      expect(result).toEqual({ found: false, barcode: '7702004003508', reason: 'disabled' });
      expect(axios.get).not.toHaveBeenCalled();
    } finally {
      env.openFoodFacts.enabled = true;
    }
  });

  test('timeout/error de red: lanza y NO se cachea (se reintenta luego)', async () => {
    axios.get.mockRejectedValueOnce(new Error('timeout of 3000ms exceeded'));
    axios.get.mockResolvedValueOnce(offFound({ product_name: 'Arroz' }));

    await expect(off.lookupByBarcode('7701234567897')).rejects.toThrow(/timeout/);
    const retry = await off.lookupByBarcode('7701234567897');

    expect(retry.found).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('ignora URLs de imagen fuera de los dominios de OFF', async () => {
    axios.get.mockResolvedValueOnce(offFound({
      product_name: 'Sospechoso',
      image_front_url: 'https://evil.example.com/img.jpg',
    }));

    const result = await off.lookupByBarcode('7709876543210');

    expect(result.found).toBe(true);
    expect(result.imageUrl).toBeNull();
  });
});

describe('openFoodFactsService.downloadImage', () => {
  test('descarga solo desde hosts permitidos, con límite de tamaño y sin redirecciones', async () => {
    axios.get.mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3]).buffer });

    const buf = await off.downloadImage('https://images.openfoodfacts.org/images/products/1.jpg');

    expect(Buffer.isBuffer(buf)).toBe(true);
    const [, config] = axios.get.mock.calls[0];
    expect(config.responseType).toBe('arraybuffer');
    expect(config.maxContentLength).toBeGreaterThan(0);
    expect(config.maxRedirects).toBe(0);
  });

  test('rechaza URLs de otros hosts (SSRF) sin hacer la petición', async () => {
    await expect(off.downloadImage('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/no permitida/);
    await expect(off.downloadImage('http://images.openfoodfacts.org/x.jpg')).rejects.toThrow(/no permitida/);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('openFoodFactsService.isOpenFoodFactsUrl', () => {
  test('detecta hotlinks a OFF', () => {
    expect(off.isOpenFoodFactsUrl('https://images.openfoodfacts.org/a.jpg')).toBe(true);
    expect(off.isOpenFoodFactsUrl('https://world.openfoodfacts.org/product/1')).toBe(true);
    expect(off.isOpenFoodFactsUrl('https://cdn.midominio.com/a.webp')).toBe(false);
    expect(off.isOpenFoodFactsUrl('https://openfoodfacts.org.evil.com/a.jpg')).toBe(false);
    expect(off.isOpenFoodFactsUrl(null)).toBe(false);
    expect(off.isOpenFoodFactsUrl('no-es-url')).toBe(false);
  });
});
