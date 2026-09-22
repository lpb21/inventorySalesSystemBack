const { parsePhoneNumberFromString } = require('libphonenumber-js');

const DEFAULT_COUNTRY = 'CO';

function normalizePhone(country, raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { ok: true, e164: null }; // teléfono es opcional en Customer
  const parsed = parsePhoneNumberFromString(value, country || DEFAULT_COUNTRY);
  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: 'No es un número de celular válido para ese país' };
  }
  return { ok: true, e164: parsed.number };
}

module.exports = { normalizePhone, DEFAULT_COUNTRY };