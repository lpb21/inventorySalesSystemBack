/**
 * Seed de tenants de prueba para el load test de k6.
 *
 * Crea N tenants aislados (vía POST /auth/register), cada uno con:
 *   - 1 usuario owner (el que crea el registro)
 *   - CASHIERS_PER_TENANT usuarios cashier adicionales
 *   - 1 categoría
 *   - PRODUCTS_PER_TENANT productos con stock muy alto (para que el load
 *     test nunca falle una venta por "stock insuficiente" y así no ensucie
 *     la métrica de errores con algo que no es una falla real del sistema)
 *
 * Escribe el resultado en tenants.json, que es el archivo que consume
 * pos-load-test.js.
 *
 * ⚠️  NUNCA apuntes esto a tu base de datos de producción real. Usa un
 * proyecto/instancia de Postgres de staging o una copia descartable.
 * Este script crea tenants y usuarios reales a través de la API pública.
 *
 * Uso:
 *   API_URL=http://localhost:3000/v1 \
 *   TENANT_COUNT=20 \
 *   CASHIERS_PER_TENANT=1 \
 *   PRODUCTS_PER_TENANT=15 \
 *   REGISTER_DELAY_MS=200 \
 *   WRITE_LIMIT_PER_MINUTE=40 \
 *   node seed-test-tenants.mjs
 *
 * Rate limits del backend que este script tiene que respetar (los dos son
 * por IP, no por tenant ni por usuario — ver reporte de seguridad):
 *
 * - authLimiter (20 intentos fallidos / 15 min): /auth/register comparte
 *   este limiter con /login. Ya cuenta solo fallos (skipSuccessfulRequests),
 *   así que mientras los registros salgan bien no se agota. Si un registro
 *   FALLA (ej. slug/email inválido) sí cuenta como intento fallido — varias
 *   corridas fallidas seguidas en poco tiempo pueden agotarlo igual. Salida
 *   rápida en local: reiniciar el proceso del backend resetea el contador
 *   (vive en memoria del proceso, no en Redis).
 * - writeOperationsLimiter (50 escrituras/min): categorías y productos
 *   pasan por aquí. WRITE_LIMIT_PER_MINUTE (default 40, con margen) hace
 *   que el script se autolimite antes de chocar contra el servidor, en vez
 *   de reventar a mitad de la siembra.
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/v1';
const TENANT_COUNT = parseInt(process.env.TENANT_COUNT || '20', 10);
const CASHIERS_PER_TENANT = parseInt(process.env.CASHIERS_PER_TENANT || '1', 10);
const PRODUCTS_PER_TENANT = parseInt(process.env.PRODUCTS_PER_TENANT || '15', 10);
const REGISTER_DELAY_MS = parseInt(process.env.REGISTER_DELAY_MS || '200', 10);
// registerSchema exige slug alphanum() puro (Joi) - nada de guiones ni
// guiones bajos, o el registro falla con 400 "Error de validación".
const RUN_ID = Date.now().toString(36).replace(/[^a-z0-9]/gi, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// writeOperationsLimiter del backend permite 50 escrituras/min POR IP en
// categorías/productos/ventas/proveedores (sin distinguir tenant ni usuario).
// Sembrar 1 categoría + N productos por tenant, todo desde la misma IP,
// choca contra ese límite en la 3ra-4ta tenant si no nos autolimitamos.
// Nos quedamos con margen (40 en vez de 50) para no rozar el borde.
const WRITE_LIMIT_PER_MINUTE = parseInt(process.env.WRITE_LIMIT_PER_MINUTE || '40', 10);
const writeTimestamps = [];

async function throttleWrite() {
  const now = Date.now();
  while (writeTimestamps.length && now - writeTimestamps[0] > 60000) {
    writeTimestamps.shift();
  }
  if (writeTimestamps.length >= WRITE_LIMIT_PER_MINUTE) {
    const waitMs = 60000 - (now - writeTimestamps[0]) + 100;
    await sleep(waitMs);
    return throttleWrite();
  }
  writeTimestamps.push(Date.now());
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const details = json?.error?.details ? ` (${json.error.details.join(', ')})` : '';
    throw new Error(
      `${method} ${path} -> HTTP ${res.status}: ${json?.error?.message || res.statusText}${details}`
    );
  }

  return json?.data ?? json;
}

async function seedTenant(index) {
  const slug = `loadtest${RUN_ID}${index}`;
  // Joi's .email() por defecto exige un TLD reconocido; ".local" no lo es
  // y hace fallar el registro con 400 aunque el email tenga formato válido.
  const ownerEmail = `owner+${slug}@loadtest.example.com`;
  const password = 'LoadTest123!';

  // 1. Crear tenant + owner
  const registerData = await api('/auth/register', {
    method: 'POST',
    body: {
      email: ownerEmail,
      password,
      name: `Owner LoadTest ${index}`,
      business_name: `Negocio LoadTest ${index}`,
      slug,
    },
  });

  const ownerToken = registerData.token;

  // 2. Crear una categoría (requerida por productSchema)
  await throttleWrite();
  const category = await api('/categories', {
    method: 'POST',
    token: ownerToken,
    body: { name: 'General' },
  });

  // 3. Crear productos con stock muy alto para no chocar con "stock insuficiente"
  const productIds = [];
  for (let p = 0; p < PRODUCTS_PER_TENANT; p++) {
    await throttleWrite();
    const product = await api('/products', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `Producto ${p + 1} (${slug})`,
        category_id: category.id,
        price: 1000 + p * 100,
        cost: 500 + p * 50,
        stock: 999999,
        min_stock: 0,
        unit: 'und',
        type: 'unit',
      },
    });
    productIds.push(product.id);
  }

  // 4. Crear usuarios cashier adicionales (simulan el resto del personal)
  const cashiers = [];
  for (let c = 0; c < CASHIERS_PER_TENANT; c++) {
    const cashierEmail = `cashier${c}+${slug}@loadtest.example.com`;
    await api('/users', {
      method: 'POST',
      token: ownerToken,
      body: {
        email: cashierEmail,
        password,
        name: `Cashier ${c + 1} LoadTest ${index}`,
        role: 'cashier',
      },
    });
    cashiers.push({ email: cashierEmail, password, role: 'cashier' });
  }

  return {
    tenant_slug: slug,
    owner: { email: ownerEmail, password, role: 'owner' },
    cashiers,
    product_ids: productIds,
  };
}

async function main() {
  console.log(`Sembrando ${TENANT_COUNT} tenants de prueba contra ${API_URL} ...`);
  const tenants = [];

  for (let i = 0; i < TENANT_COUNT; i++) {
    try {
      const tenant = await seedTenant(i);
      tenants.push(tenant);
      console.log(
        `  [${i + 1}/${TENANT_COUNT}] ${tenant.tenant_slug}: owner + ${tenant.cashiers.length} cashier(s) + ${tenant.product_ids.length} productos`
      );
    } catch (err) {
      console.error(`  [${i + 1}/${TENANT_COUNT}] ERROR: ${err.message}`);
    }

    if (REGISTER_DELAY_MS > 0 && i < TENANT_COUNT - 1) {
      await sleep(REGISTER_DELAY_MS);
    }
  }

  const outFile = new URL('./tenants.json', import.meta.url);
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(outFile, JSON.stringify(tenants, null, 2))
  );

  console.log(`\nListo. ${tenants.length} tenants escritos en ${outFile.pathname}`);
  console.log('Ahora corre: k6 run pos-load-test.js');
}

main().catch((err) => {
  console.error('Fallo el seed:', err);
  process.exit(1);
});
