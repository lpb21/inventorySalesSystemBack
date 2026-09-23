/**
 * Backfill de imágenes de productos desde Open Food Facts.
 *
 * Recorre los productos activos con código de barras, sin imagen y sin origen gestionado,
 * y les busca imagen en OFF al ritmo permitido (~85 req/min). Se puede correr varias veces:
 * los que ya tienen imagen o se marcaron como "none" se omiten.
 *
 * Uso:
 *   node scripts/backfill-product-images.js [--tenant=<uuid>] [--limit=500] [--dry-run]
 *   npm run images:backfill -- --tenant=<uuid>
 */
const env = require('../src/config/env');
const { Op } = require('sequelize');
const { sequelize, Product } = require('../src/models');
const productImageService = require('../src/services/productImageService');
const storageService = require('../src/services/storageService');

function parseArgs(argv) {
  const args = { tenant: null, limit: null, dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length);
    else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.slice('--limit='.length), 10) || null;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!env.openFoodFacts.enabled) {
    console.error('Open Food Facts está desactivado (OFF_ENABLED=false).');
    process.exitCode = 1;
    return;
  }
  if (!storageService.isConfigured()) {
    console.error('S3 no está configurado (falta S3_BUCKET).');
    process.exitCode = 1;
    return;
  }

  const where = {
    is_active: true,
    barcode: { [Op.ne]: null },
    image_url: null,
    image_source: null,
  };
  if (args.tenant) where.tenant_id = args.tenant;

  const products = await Product.findAll({
    where,
    attributes: ['id', 'tenant_id', 'barcode', 'name'],
    order: [['created_at', 'ASC']],
    limit: args.limit || undefined,
  });

  console.log(`Productos candidatos: ${products.length}${args.dryRun ? ' (dry-run)' : ''}`);
  if (args.dryRun) return;

  const summary = { updated: 0, not_found: 0, skipped: 0, unavailable: 0, error: 0 };

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const result = await productImageService.enrichFromOpenFoodFacts(p.tenant_id, p.id);
      summary[result.status] = (summary[result.status] || 0) + 1;
      console.log(`[${i + 1}/${products.length}] ${p.barcode} ${p.name} → ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
    } catch (error) {
      summary.error++;
      console.log(`[${i + 1}/${products.length}] ${p.barcode} ${p.name} → error: ${error.message}`);
    }
  }

  console.log('Resumen:', summary);
}

main()
  .catch((error) => {
    console.error('Backfill falló:', error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
