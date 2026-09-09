/**
 * Normalización de encabezados de CSV para la importación de productos.
 * Traduce encabezados en español o inglés a las claves internas que espera
 * el servicio de importación. Acepta ambos idiomas indistintamente.
 */

const HEADER_ALIASES = {
  nombre: 'name', name: 'name',
  descripcion: 'description', description: 'description', detalle: 'description',
  categoria: 'category', category: 'category',
  precio: 'price', price: 'price', precio_venta: 'price',
  costo: 'cost', cost: 'cost', precio_costo: 'cost',
  codigo: 'sku', sku: 'sku', codigo_interno: 'sku', referencia: 'sku',
  codigo_barras: 'barcode', codigo_de_barras: 'barcode', barras: 'barcode', barcode: 'barcode', ean: 'barcode',
  stock: 'stock', existencias: 'stock', cantidad: 'stock',
  stock_minimo: 'min_stock', min_stock: 'min_stock', minimo: 'min_stock',
  unidad: 'unit', unit: 'unit', medida: 'unit',
  tipo: 'type', type: 'type',
  fecha_vencimiento: 'expiry_date', fecha_de_vencimiento: 'expiry_date', vencimiento: 'expiry_date', expiry_date: 'expiry_date',
  proveedor: 'supplier', supplier: 'supplier',
  notas: 'notes', notes: 'notes', observaciones: 'notes',
};

function normalizeKey(key) {
  return String(key)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = HEADER_ALIASES[normalizeKey(key)];
    if (canonical) out[canonical] = value;
  }
  return out;
}

module.exports = { HEADER_ALIASES, normalizeKey, normalizeRow };