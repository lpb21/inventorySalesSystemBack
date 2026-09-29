const {
  SMS_MAX_LENGTH,
  formatCOP,
  toSmsText,
  buildSmsChargeMessage,
  buildSmsPaymentMessage,
} = require('../src/utils/smsMessages');

// Caracteres seguros en GSM-7 (sin extendidos): si aparece otro, el SMS pasa a UCS-2.
const GSM7_SAFE = /^[A-Za-z0-9 .,:;!?()&'\-/$#%+*=@]*$/;

// DECIMAL(12,2) → el monto más grande posible.
const MAX_AMOUNT = '9999999999.99';
const LONG_NAME = 'Salsamentaría y Carnicería Doña Rosa — La Mejor Del Barrio San Cristóbal Sur, Sucursal Principal Número Uno';

describe('formatCOP', () => {
  it('formatea con punto de miles, sin decimales ni espacio', () => {
    expect(formatCOP(18000)).toBe('$18.000');
    expect(formatCOP('157600.00')).toBe('$157.600');
    expect(formatCOP(0)).toBe('$0');
    expect(formatCOP(999)).toBe('$999');
  });

  it('redondea centavos', () => {
    expect(formatCOP('12500.60')).toBe('$12.501');
  });

  it('rechaza montos inválidos', () => {
    expect(() => formatCOP('abc')).toThrow(TypeError);
  });
});

describe('toSmsText', () => {
  it('quita tildes, eñes y emojis', () => {
    expect(toSmsText('Doña Rosa Pañalería 🍖 Ñandú')).toBe('Dona Rosa Panaleria Nandu');
  });
});

describe('buildSmsChargeMessage', () => {
  it('genera el texto esperado', () => {
    const msg = buildSmsChargeMessage({
      customerName: 'Ana',
      businessName: 'Punto Fresco',
      total: '18000.00',
      balance: '157600.00',
    });
    expect(msg).toBe('Punto Fresco: fiado de $18.000 registrado. Saldo pendiente: $157.600');
  });

  it('no pasa de 160 caracteres con montos máximos y nombre largo', () => {
    const msg = buildSmsChargeMessage({
      businessName: LONG_NAME,
      total: MAX_AMOUNT,
      balance: MAX_AMOUNT,
    });
    expect(msg.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);
    expect(msg).toMatch(/Saldo pendiente: \$10\.000\.000\.000$/);
  });

  it('solo usa caracteres GSM-7', () => {
    const msg = buildSmsChargeMessage({ businessName: LONG_NAME, total: 18000, balance: 157600 });
    expect(msg).toMatch(GSM7_SAFE);
  });
});

describe('buildSmsPaymentMessage', () => {
  it('muestra el saldo pendiente cuando queda deuda', () => {
    const msg = buildSmsPaymentMessage({
      businessName: 'Punto Fresco',
      amount: '50000.00',
      balance: '107600.00',
    });
    expect(msg).toBe('Punto Fresco: abono de $50.000 recibido. Saldo pendiente: $107.600');
  });

  it('indica cuenta al día cuando el saldo llega a 0', () => {
    const msg = buildSmsPaymentMessage({ businessName: 'Punto Fresco', amount: 20000, balance: '0.00' });
    expect(msg).toBe('Punto Fresco: abono de $20.000 recibido. Tu cuenta quedo al dia. Gracias!');
  });

  it('no pasa de 160 caracteres con montos máximos y nombre largo', () => {
    for (const balance of [MAX_AMOUNT, 0]) {
      const msg = buildSmsPaymentMessage({ businessName: LONG_NAME, amount: MAX_AMOUNT, balance });
      expect(msg.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);
      expect(msg).toMatch(GSM7_SAFE);
    }
  });
});
