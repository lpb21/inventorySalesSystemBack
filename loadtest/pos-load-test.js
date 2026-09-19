/**
 * Prueba de carga multi-tenant para inventorySalesSystemBack.
 *
 * Simula el patrón de uso real de un POS/inventario: cada "usuario virtual"
 * (VU) de k6 representa a UN empleado (owner o cashier) de UN tenant, que
 * inicia sesión una sola vez y luego repite un flujo de acciones típico de
 * un turno de trabajo (consultar productos, ver dashboard, registrar
 * ventas, revisar inventario) con pausas entre acciones, no en bucle
 * cerrado.
 *
 * Requiere haber corrido antes: node seed-test-tenants.mjs
 * (genera tenants.json, que este script lee).
 *
 * ⚠️  IMPORTANTE — Rate limiting por IP:
 * Ningún limiter del backend usa keyGenerator, así que generalLimiter
 * (100 req/min) y authLimiter (20/15min) limitan por IP, no por usuario ni
 * por tenant (ver reporte de seguridad). Si corres k6 desde una sola
 * máquina, vas a chocar contra ESE límite mucho antes que contra la
 * capacidad real de CPU/RAM/DB del servidor — vas a medir el rate limiter,
 * no el backend. Dos formas de manejarlo:
 *
 *   1. "Prueba realista de borde público": déjalo tal cual. Te dice qué le
 *      pasa a un conjunto de tenants que, por mala suerte, comparten salida
 *      NAT (oficina, VPN corporativa) — un escenario real, aunque no el
 *      típico.
 *   2. "Prueba de capacidad pura del backend": sube temporalmente
 *      generalLimiter.max en un entorno de staging (nunca en producción)
 *      mientras corres el test, o distribuye la carga desde varias IPs
 *      (k6 cloud, o varias instancias EC2 pequeñas corriendo k6 en modo
 *      --out para agregarlas). Este script no hace eso por ti: es una
 *      decisión de infraestructura, no del script.
 *
 * Uso básico (perfil por defecto = ramp):
 *   BASE_URL=http://TU_IP_O_DOMINIO:3000/v1 k6 run pos-load-test.js
 *
 * Perfiles disponibles (variable de entorno PROFILE):
 *   smoke  -> 1 VU, 1 minuto. Sanity check antes de correr algo más grande.
 *   ramp   -> (default) sube de 0 a TARGET_VUS por etapas, para encontrar
 *             el punto donde la latencia/errores se disparan.
 *   soak   -> carga constante sostenida por SOAK_DURATION, para detectar
 *             fugas de memoria / degradación con el tiempo (relevante para
 *             el max_memory_restart:300M de tu ecosystem.config.js).
 *
 * Variables de entorno relevantes:
 *   BASE_URL          (default: http://localhost:3000/v1)
 *   TENANTS_FILE      (default: ./tenants.json)
 *   PROFILE           smoke | ramp | soak      (default: ramp)
 *   TARGET_VUS        VUs pico en el perfil ramp (default: tamaño del pool de usuarios sembrados, tope 200)
 *   SOAK_VUS          VUs constantes en el perfil soak (default: 20)
 *   SOAK_DURATION     duración del perfil soak (default: 15m)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/v1';
const TENANTS_FILE = __ENV.TENANTS_FILE || './tenants.json';
const PROFILE = __ENV.PROFILE || 'ramp';

// ── Datos sembrados (tenants.json) ──────────────────────────────────────
const tenants = new SharedArray('tenants', function () {
  const data = JSON.parse(open(TENANTS_FILE));
  if (!data.length) {
    throw new Error(
      `${TENANTS_FILE} está vacío. Corre primero: node seed-test-tenants.mjs`
    );
  }
  return data;
});

// Aplanamos a "identidades": una por cada empleado (owner + cashiers) de
// cada tenant. Cada identidad conoce los product_ids de SU tenant, para no
// mezclar datos entre negocios.
const identities = new SharedArray('identities', function () {
  const data = JSON.parse(open(TENANTS_FILE));
  const list = [];
  for (const tenant of data) {
    list.push({
      tenant_slug: tenant.tenant_slug,
      email: tenant.owner.email,
      password: tenant.owner.password,
      role: 'owner',
      product_ids: tenant.product_ids,
    });
    for (const cashier of tenant.cashiers) {
      list.push({
        tenant_slug: tenant.tenant_slug,
        email: cashier.email,
        password: cashier.password,
        role: 'cashier',
        product_ids: tenant.product_ids,
      });
    }
  }
  return list;
});

// ── Métricas custom ──────────────────────────────────────────────────────
const loginFailures = new Counter('login_failures');
const saleFailures = new Counter('sale_failures');
const saleDuration = new Trend('sale_duration', true);
const rateLimited = new Counter('rate_limited_429');

// ── Perfiles de carga ────────────────────────────────────────────────────
const DEFAULT_TARGET_VUS = Math.min(identities.length || 1, 200);
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || String(DEFAULT_TARGET_VUS), 10);
const SOAK_VUS = parseInt(__ENV.SOAK_VUS || '20', 10);
const SOAK_DURATION = __ENV.SOAK_DURATION || '15m';

const PROFILES = {
  smoke: {
    scenarios: {
      smoke: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
      },
    },
  },
  ramp: {
    scenarios: {
      ramp: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '1m', target: Math.ceil(TARGET_VUS * 0.25) },
          { duration: '2m', target: Math.ceil(TARGET_VUS * 0.5) },
          { duration: '3m', target: Math.ceil(TARGET_VUS * 0.75) },
          { duration: '3m', target: TARGET_VUS },
          { duration: '5m', target: TARGET_VUS }, // sostener el pico
          { duration: '1m', target: 0 },
        ],
      },
    },
  },
  soak: {
    scenarios: {
      soak: {
        executor: 'constant-vus',
        vus: SOAK_VUS,
        duration: SOAK_DURATION,
      },
    },
  },
};

export const options = {
  ...PROFILES[PROFILE],
  thresholds: {
    http_req_failed: ['rate<0.02'], // <2% de requests con error real
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:products_list}': ['p(95)<500'],
    'http_req_duration{name:dashboard}': ['p(95)<800'],
    'http_req_duration{name:create_sale}': ['p(95)<800'],
    sale_failures: ['count<50'],
    rate_limited_429: ['count<50'], // si esto se dispara, estás midiendo el rate limiter, no el backend
  },
};

// Estado por VU (persiste entre iteraciones de la misma VU, se resetea si
// k6 recicla la VU). Guardamos el token para no hacer login en cada
// iteración: eso mantendría inflado el conteo de /auth/login contra el
// authLimiter y no reflejaría uso real (un cajero no re-loguea en cada clic).
let vuToken = null;
let vuIdentity = null;
let vuShiftOpened = false;

function pickIdentity() {
  const idx = (exec.vu.idInTest - 1) % identities.length;
  return identities[idx];
}

function login(identity) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: identity.email, password: identity.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
  );

  if (res.status === 429) rateLimited.add(1);

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login devuelve token': (r) => !!r.json('data.token'),
  });

  if (!ok) {
    loginFailures.add(1);
    return null;
  }

  return res.json('data.token');
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

// Solo los cashiers necesitan turno de caja abierto para vender
// (saleService.createSale lo exige por rol; los owner/admin/supervisor no).
// Se abre una sola vez por VU - reabrir en cada iteración fallaría con
// "Ya tienes un turno abierto" y desperdiciaría presupuesto de
// writeOperationsLimiter sin necesidad.
function openShiftIfNeeded(token, identity) {
  if (vuShiftOpened || identity.role !== 'cashier') return;

  const res = http.post(
    `${BASE_URL}/cash-registers/open`,
    JSON.stringify({ opening_amount: 50000, name: 'Turno load test' }),
    { ...authHeaders(token), tags: { name: 'open_shift' } }
  );

  if (res.status === 429) rateLimited.add(1);

  // 201 = se abrió; 400 "ya tienes un turno abierto" también es un estado
  // válido (por ejemplo si esta VU quedó de una corrida anterior) - en
  // ambos casos ya hay un turno abierto y no hace falta reintentar.
  vuShiftOpened = res.status === 201 || res.status === 400;

  if (!vuShiftOpened) {
    console.error(`open shift failed: HTTP ${res.status} - ${(res.body || '').slice(0, 300)}`);
  }
}

// ── Acciones individuales (cada una = una operación real de la app) ─────

function actionListProducts(token) {
  const res = http.get(`${BASE_URL}/products?page=1&limit=20`, {
    ...authHeaders(token),
    tags: { name: 'products_list' },
  });
  if (res.status === 429) rateLimited.add(1);
  check(res, { 'products 200': (r) => r.status === 200 });
}

function actionDashboard(token) {
  const res = http.get(`${BASE_URL}/reports/dashboard`, {
    ...authHeaders(token),
    tags: { name: 'dashboard' },
  });
  if (res.status === 429) rateLimited.add(1);
  check(res, { 'dashboard 200': (r) => r.status === 200 });
}

function actionInventory(token) {
  const res = http.get(`${BASE_URL}/inventory`, {
    ...authHeaders(token),
    tags: { name: 'inventory_list' },
  });
  if (res.status === 429) rateLimited.add(1);
  check(res, { 'inventory 200': (r) => r.status === 200 });
}

function actionCustomers(token) {
  const res = http.get(`${BASE_URL}/customers?page=1&limit=20`, {
    ...authHeaders(token),
    tags: { name: 'customers_list' },
  });
  if (res.status === 429) rateLimited.add(1);
  check(res, { 'customers 200': (r) => r.status === 200 });
}

function actionSalesToday(token) {
  const res = http.get(`${BASE_URL}/sales/today`, {
    ...authHeaders(token),
    tags: { name: 'sales_today' },
  });
  if (res.status === 429) rateLimited.add(1);
  check(res, { 'sales_today 200': (r) => r.status === 200 });
}

function actionCreateSale(token, identity) {
  // 1 a 3 líneas, productos del propio tenant, cantidades chicas y
  // realistas de un ticket de mostrador.
  const itemCount = 1 + Math.floor(Math.random() * 3);
  const items = [];
  let subtotal = 0;
  for (let i = 0; i < itemCount; i++) {
    const productId =
      identity.product_ids[Math.floor(Math.random() * identity.product_ids.length)];
    const quantity = 1 + Math.floor(Math.random() * 3);
    // saleSchema (Joi) exige unit_price/subtotal/total como requeridos,
    // pero saleService.createSale los ignora y recalcula todo desde el
    // precio real del producto en la base de datos ("Precio SIEMPRE desde
    // la BD, nunca del cliente"). Cualquier valor positivo que pase la
    // validación sirve aquí — no afecta el total real de la venta creada.
    const unitPrice = 1000;
    items.push({ product_id: productId, quantity, unit_price: unitPrice });
    subtotal += unitPrice * quantity;
  }

  const payload = JSON.stringify({
    items,
    payment_method: 'cash',
    subtotal,
    total: subtotal,
  });

  const res = http.post(`${BASE_URL}/sales`, payload, {
    ...authHeaders(token),
    tags: { name: 'create_sale' },
  });

  if (res.status === 429) rateLimited.add(1);
  saleDuration.add(res.timings.duration);

  const ok = check(res, { 'sale 201': (r) => r.status === 201 });
  if (!ok) {
    saleFailures.add(1);
    if (res.status !== 429) {
      // No debería pasar con stock 999999: si aparece, es un bug real del
      // script o del backend, no ruido de negocio - imprime el motivo real
      // en vez de dejarte adivinar.
      console.error(`sale failed: HTTP ${res.status} - ${(res.body || '').slice(0, 300)}`);
    }
  }
}

// ── Flujo por iteración ───────────────────────────────────────────────────
// Pesos aproximados a un turno real de POS: se consulta mucho más de lo que
// se escribe, y las ventas (la operación más cara: transacción + locks de
// stock + movimientos de inventario) son una fracción del tráfico total.
const ACTIONS = [
  { weight: 35, run: actionListProducts, needsIdentity: false },
  // 'reports:read' (permissionMiddleware.js) excluye al rol cashier - si se
  // le deja disparar esta acción, el 403 esperado infla el % de fallas del
  // test con algo que no es un problema del backend sino del propio rol.
  { weight: 15, run: actionDashboard, needsIdentity: false, requiresReportsAccess: true },
  { weight: 10, run: actionInventory, needsIdentity: false },
  { weight: 10, run: actionCustomers, needsIdentity: false },
  { weight: 10, run: actionSalesToday, needsIdentity: false },
  { weight: 20, run: actionCreateSale, needsIdentity: true },
];

// Debe reflejar exactamente los roles permitidos en 'reports:read' dentro de
// src/middlewares/permissionMiddleware.js del backend.
const REPORTS_READ_ROLES = ['owner', 'admin', 'supervisor', 'superadmin'];

function pickAction(identity) {
  const canViewReports = REPORTS_READ_ROLES.includes(identity.role);
  const pool = ACTIONS.filter((a) => !a.requiresReportsAccess || canViewReports);
  const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);

  let r = Math.random() * totalWeight;
  for (const action of pool) {
    if (r < action.weight) return action;
    r -= action.weight;
  }
  return pool[0];
}

export default function () {
  if (!vuIdentity) {
    vuIdentity = pickIdentity();
  }

  if (!vuToken) {
    vuToken = login(vuIdentity);
    if (!vuToken) {
      // Backoff si el login falló (ej. 429 del authLimiter): no reintentar
      // en caliente, eso solo empeoraría el limitador.
      sleep(5);
      return;
    }
  }

  openShiftIfNeeded(vuToken, vuIdentity);

  const action = pickAction(vuIdentity);
  if (action.needsIdentity) {
    action.run(vuToken, vuIdentity);
  } else {
    action.run(vuToken);
  }

  // Pausa entre acciones: un humano operando un POS no dispara requests en
  // bucle cerrado. 1-4s cubre "mirar la pantalla, escanear el siguiente
  // producto, atender al cliente".
  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        profile: PROFILE,
        target_vus: PROFILE === 'ramp' ? TARGET_VUS : PROFILE === 'soak' ? SOAK_VUS : 1,
        identities_seeded: identities.length,
        tenants_seeded: tenants.length,
        http_req_duration_p95: data.metrics.http_req_duration?.values['p(95)'],
        http_req_duration_p99: data.metrics.http_req_duration?.values['p(99)'],
        http_req_failed_rate: data.metrics.http_req_failed?.values.rate,
        rate_limited_429: data.metrics.rate_limited_429?.values.count || 0,
        sale_failures: data.metrics.sale_failures?.values.count || 0,
      },
      null,
      2
    ) + '\n',
  };
}
