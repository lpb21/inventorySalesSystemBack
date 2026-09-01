const {
  getPeriodConfig,
  calculatePeriodEnd,
  PERIODS,
} = require('../src/utils/subscriptionDates');

describe('subscriptionDates - getPeriodConfig', () => {
  test('mapea los cuatro periodos válidos con sus días y status', () => {
    expect(getPeriodConfig('trial')).toEqual({ days: 7, status: 'trial' });
    expect(getPeriodConfig('monthly')).toEqual({ days: 30, status: 'active' });
    expect(getPeriodConfig('quarterly')).toEqual({ days: 90, status: 'active' });
    expect(getPeriodConfig('biannual')).toEqual({ days: 180, status: 'active' });
    expect(getPeriodConfig('yearly')).toEqual({ days: 365, status: 'active' });
  });

  test('devuelve null para un periodo inválido', () => {
    expect(getPeriodConfig('lifetime')).toBeNull();
    expect(getPeriodConfig('')).toBeNull();
    expect(getPeriodConfig(undefined)).toBeNull();
  });
});

describe('subscriptionDates - calculatePeriodEnd', () => {
  test('el vencimiento cae a las 08:30 UTC (3:30 AM Colombia)', () => {
    const from = new Date('2026-08-21T14:00:00.000Z'); // una tarde cualquiera
    const end = calculatePeriodEnd(30, from);

    expect(end.getUTCHours()).toBe(8);
    expect(end.getUTCMinutes()).toBe(30);
    expect(end.getUTCSeconds()).toBe(0);
    expect(end.getUTCMilliseconds()).toBe(0);
  });

  test('suma los días del ciclo correctamente', () => {
    const from = new Date('2026-08-21T14:00:00.000Z');
    const end = calculatePeriodEnd(30, from);

    // 30 días después del 21 de agosto = 20 de septiembre
    expect(end.toISOString()).toBe('2026-09-20T08:30:00.000Z');
  });

  test('la hora del pago NO afecta la hora del corte (siempre 08:30 UTC)', () => {
    // Dos pagos el mismo día a horas muy distintas...
    const manana = calculatePeriodEnd(30, new Date('2026-08-21T06:00:00.000Z'));
    const noche  = calculatePeriodEnd(30, new Date('2026-08-21T23:00:00.000Z'));

    // ...pero como cruzan medianoche UTC distinto, el punto es que AMBOS
    // terminan a las 08:30 UTC exactas (el corte es fijo, no depende de la hora del pago)
    expect(manana.getUTCHours()).toBe(8);
    expect(manana.getUTCMinutes()).toBe(30);
    expect(noche.getUTCHours()).toBe(8);
    expect(noche.getUTCMinutes()).toBe(30);
  });
});