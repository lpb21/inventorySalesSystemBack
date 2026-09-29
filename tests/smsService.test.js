// Twilio mockeado: esta suite nunca envía SMS reales ni gasta saldo.
const mockCreate = jest.fn();
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const ORIGINAL_ENV = { ...process.env };

// Carga smsService con un env fresco (env.js lee process.env al requerirse).
function loadSmsService(overrides = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    TWILIO_ACCOUNT_SID: 'ACtest',
    TWILIO_AUTH_TOKEN: 'token',
    TWILIO_PHONE_NUMBER: '+18250000000',
    SMS_ENABLED: 'true',
    SMS_MONTHLY_CAP: '0',
    ...overrides,
  };
  let service;
  jest.isolateModules(() => {
    service = require('../src/services/smsService');
  });
  return service;
}

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('smsService.sendSms', () => {
  it('envía con el número configurado y devuelve el sid', async () => {
    mockCreate.mockResolvedValue({ sid: 'SM123', status: 'queued', numSegments: '1' });
    const { sendSms } = loadSmsService();

    const result = await sendSms('+573001234567', 'Hola');

    expect(mockCreate).toHaveBeenCalledWith({ to: '+573001234567', from: '+18250000000', body: 'Hola' });
    expect(result).toEqual({ ok: true, sid: 'SM123', segments: 1 });
  });

  it('no envía si SMS_ENABLED=false', async () => {
    const { sendSms } = loadSmsService({ SMS_ENABLED: 'false' });
    const result = await sendSms('+573001234567', 'Hola');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, skipped: 'disabled' });
  });

  it('no envía si faltan credenciales', async () => {
    const { sendSms } = loadSmsService({ TWILIO_AUTH_TOKEN: '' });
    const result = await sendSms('+573001234567', 'Hola');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.skipped).toBe('not_configured');
  });

  it('error 21614 (número fijo) no lanza, solo devuelve ok=false', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('not a mobile number'), { code: 21614 }));
    const { sendSms } = loadSmsService();

    const result = await sendSms('+576015551234', 'Hola');

    expect(result).toMatchObject({ ok: false, code: 21614 });
    expect(console.warn).toHaveBeenCalled();
  });

  it('cualquier otro error de Twilio tampoco lanza', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('boom'), { code: 20003, status: 401 }));
    const { sendSms } = loadSmsService();

    await expect(sendSms('+573001234567', 'Hola')).resolves.toMatchObject({ ok: false, code: 20003 });
    expect(console.error).toHaveBeenCalled();
  });

  it('respeta el tope mensual', async () => {
    mockCreate.mockResolvedValue({ sid: 'SM1', status: 'queued', numSegments: '1' });
    const { sendSms } = loadSmsService({ SMS_MONTHLY_CAP: '2' });

    await sendSms('+573001234567', 'a');
    await sendSms('+573001234567', 'b');
    const third = await sendSms('+573001234567', 'c');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(third).toEqual({ ok: false, skipped: 'monthly_cap' });
  });
});
