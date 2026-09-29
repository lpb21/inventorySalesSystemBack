/**
 * Mensajes SMS de fiados (cargo y abono).
 *
 * Reglas:
 * - Texto plano GSM-7: sin tildes, sin emojis, sin *negritas* (eso es de WhatsApp).
 *   Un solo caracter fuera de GSM-7 pasa el SMS a UCS-2 y el segmento baja a 70.
 * - Un segmento: 160 caracteres o menos. Cada segmento extra se cobra aparte.
 * - Sin detalle de items: solo total/abono y saldo.
 */
const SMS_MAX_LENGTH = 160;

// Sequelize devuelve DECIMAL de Postgres como STRING ("12500.00").
function toNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new TypeError(`Monto invalido: ${v}`);
  return n;
}

// '$157.600'. No se usa Intl: en es-CO mete un espacio no separable (U+00A0)
// que no existe en GSM-7 y convertiría el SMS en UCS-2.
function formatCOP(v) {
  const n = Math.round(toNumber(v));
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${digits}`;
}

// Quita tildes (á -> a, ñ -> n) y todo lo que no sea un caracter seguro de GSM-7.
function toSmsText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,:;!?()&'\-/$#%+*=@]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Arma "<negocio><rest>" recortando el nombre del negocio si el total pasa de 160.
function withBusinessName(businessName, rest) {
  const available = SMS_MAX_LENGTH - rest.length;
  const name = toSmsText(businessName).slice(0, Math.max(available, 0)).trim();
  return `${name}${rest}`;
}

/**
 * Mensaje de cargo (fiado).
 * balance: saldo DESPUES de registrar el fiado.
 */
function buildSmsChargeMessage({ businessName, total, balance }) {
  return withBusinessName(
    businessName,
    `: fiado de ${formatCOP(total)} registrado. Saldo pendiente: ${formatCOP(balance)}`
  );
}

/**
 * Mensaje de abono.
 * balance: saldo DESPUES del abono.
 */
function buildSmsPaymentMessage({ businessName, amount, balance }) {
  const settled = toNumber(balance) <= 0;
  const tail = settled
    ? 'Tu cuenta quedo al dia. Gracias!'
    : `Saldo pendiente: ${formatCOP(balance)}`;
  return withBusinessName(
    businessName,
    `: abono de ${formatCOP(amount)} recibido. ${tail}`
  );
}

module.exports = {
  SMS_MAX_LENGTH,
  formatCOP,
  toSmsText,
  buildSmsChargeMessage,
  buildSmsPaymentMessage,
};
