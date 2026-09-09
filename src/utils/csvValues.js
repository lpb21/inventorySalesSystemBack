/**
 * Normalización y validación de VALORES del CSV de importación de productos.
 * Acepta español (unidad, peso, libra, kilo...) y lo traduce a los valores
 * internos que aceptan los check constraints de la BD, con mensajes claros.
 */

function base(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita tildes
}

// tipo -> weight | unit | portion
const TYPE_ALIASES = {
  weight: 'weight', peso: 'weight', 'por peso': 'weight', porpeso: 'weight', 'al peso': 'weight',
  unit: 'unit', unidad: 'unit', 'por unidad': 'unit', porunidad: 'unit', unitario: 'unit',
  portion: 'portion', porcion: 'portion', 'por porcion': 'portion', porciones: 'portion',
};

// unidad de medida -> kg | lb | und | paq | l | ml
const UNIT_ALIASES = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  lb: 'lb', libra: 'lb', libras: 'lb',
  und: 'und', unidad: 'und', unidades: 'und', u: 'und', un: 'und',
  paq: 'paq', paquete: 'paq', paquetes: 'paq',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
};

function normalizeType(value) {
  const key = base(value);
  if (key === '') return { valid: true, value: 'unit' };
  const canonical = TYPE_ALIASES[key];
  return canonical ? { valid: true, value: canonical } : { valid: false, value: null };
}

function normalizeUnit(value) {
  const key = base(value);
  if (key === '') return { valid: true, value: 'und' };
  const canonical = UNIT_ALIASES[key];
  return canonical ? { valid: true, value: canonical } : { valid: false, value: null };
}

function normalizeDate(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return { valid: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { valid: false, value: null };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { valid: false, value: null };
  return { valid: true, value: raw };
}

module.exports = { normalizeType, normalizeUnit, normalizeDate };