const sharp = require('sharp');
const { processProductImage } = require('../src/services/imageService');

// Genera una imagen de prueba de color sólido
async function makeImage({ width, height, format = 'jpeg', color = { r: 200, g: 30, b: 30 }, alpha = 1 }) {
  const img = sharp({
    create: { width, height, channels: 4, background: { ...color, alpha } },
  });
  if (format === 'png') return img.png().toBuffer();
  if (format === 'webp') return img.webp().toBuffer();
  return img.jpeg().toBuffer();
}

async function pixelAt(buffer, x, y) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const idx = (y * info.width + x) * info.channels;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

describe('imageService.processProductImage', () => {
  test('normaliza cualquier imagen a WebP cuadrado de 512px', async () => {
    const input = await makeImage({ width: 1600, height: 1200 });

    const out = await processProductImage(input);
    const meta = await sharp(out.buffer).metadata();

    expect(out.contentType).toBe('image/webp');
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  test('el resultado pesa mucho menos que el original', async () => {
    const input = await makeImage({ width: 3000, height: 3000, format: 'png' });

    const out = await processProductImage(input);

    expect(out.buffer.length).toBeLessThan(input.length);
    expect(out.buffer.length).toBeLessThan(60 * 1024);
  });

  test('fit contain: no recorta, rellena con blanco los bordes', async () => {
    // Imagen muy ancha: debe quedar completa con bandas blancas arriba y abajo
    const input = await makeImage({ width: 1000, height: 200, color: { r: 0, g: 0, b: 255 } });

    const out = await processProductImage(input);

    const top = await pixelAt(out.buffer, 256, 5);
    const center = await pixelAt(out.buffer, 256, 256);

    expect(top.r).toBeGreaterThan(240);
    expect(top.g).toBeGreaterThan(240);
    expect(top.b).toBeGreaterThan(240);
    expect(center.b).toBeGreaterThan(200);
    expect(center.r).toBeLessThan(60);
  });

  test('la transparencia se aplana sobre fondo blanco', async () => {
    const input = await makeImage({ width: 400, height: 400, format: 'png', alpha: 0 });

    const out = await processProductImage(input);
    const meta = await sharp(out.buffer).metadata();
    const px = await pixelAt(out.buffer, 200, 200);

    expect(meta.hasAlpha).toBe(false);
    expect(px.r).toBeGreaterThan(240);
    expect(px.g).toBeGreaterThan(240);
    expect(px.b).toBeGreaterThan(240);
  });

  test('no conserva metadatos EXIF (p. ej. GPS)', async () => {
    const input = await sharp({
      create: { width: 600, height: 400, channels: 3, background: { r: 10, g: 150, b: 10 } },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'tendero', ImageDescription: 'foto con metadatos' } })
      .toBuffer();

    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processProductImage(input);

    expect((await sharp(out.buffer).metadata()).exif).toBeUndefined();
  });

  test('rechaza un archivo que no es imagen aunque diga serlo', async () => {
    const fake = Buffer.from('esto no es una imagen, es texto con extensión .jpg');

    await expect(processProductImage(fake)).rejects.toThrow(/no es una imagen válida/i);
  });

  test('rechaza un buffer vacío', async () => {
    await expect(processProductImage(Buffer.alloc(0))).rejects.toThrow(/ninguna imagen/i);
  });

  test('rechaza imágenes con demasiados píxeles (bomba de descompresión)', async () => {
    const input = await makeImage({ width: 2000, height: 2000 });

    await expect(
      processProductImage(input, { maxInputPixels: 1000 * 1000 })
    ).rejects.toThrow(/resolución demasiado grande|no es una imagen válida/i);
  });

  test('procesa varias imágenes concurrentes sin fallar (semáforo)', async () => {
    const inputs = await Promise.all(
      Array.from({ length: 5 }, () => makeImage({ width: 800, height: 800 }))
    );

    const outs = await Promise.all(inputs.map((buf) => processProductImage(buf)));

    expect(outs).toHaveLength(5);
    outs.forEach((o) => expect(o.contentType).toBe('image/webp'));
  });
});
