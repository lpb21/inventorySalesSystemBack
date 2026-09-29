const { evaluateStatus, buildAlertMessage } = require('../src/services/smsBalanceAlertService');

describe('evaluateStatus (saldo Twilio vs créditos vendidos)', () => {
  it('sin créditos vendidos siempre es ok', () => {
    expect(evaluateStatus(0, 0)).toBe('ok');
  });

  it('critical si el saldo no cubre lo vendido', () => {
    expect(evaluateStatus(9.99, 10)).toBe('critical');
  });

  it('warning si cubre pero sin el margen', () => {
    expect(evaluateStatus(11, 10, 1.2)).toBe('warning');
  });

  it('ok si cubre con margen', () => {
    expect(evaluateStatus(12, 10, 1.2)).toBe('ok');
  });
});

describe('buildAlertMessage', () => {
  it('cabe en un SMS de 160 caracteres', () => {
    const msg = buildAlertMessage({
      status: 'critical', providerBalance: 123456.789, currency: 'USD',
      committedCredits: 9999999, committedCost: 499999.95,
    });
    expect(msg.length).toBeLessThanOrEqual(160);
    expect(msg).toMatch(/CRITICA/);
  });

  it('mensaje de error cuando no se pudo consultar Twilio', () => {
    expect(buildAlertMessage({ status: 'error' })).toMatch(/no se pudo consultar/);
  });
});
