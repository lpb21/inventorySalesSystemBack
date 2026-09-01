/**
 * Utilidades de fechas y periodos de suscripción.
 * El corte de acceso ocurre a las 3:30 AM hora Colombia (UTC-5) = 08:30 UTC,
 * para que el cliente opere todo su día y el bloqueo caiga con el local cerrado.
 */

const CUTOFF_HOUR_UTC = 8;    // 3:30 AM Colombia = 8:30 UTC
const CUTOFF_MINUTE_UTC = 30;

// Periodos disponibles y su equivalencia en días + estado resultante
const PERIODS = {
  trial:     { days: 7,   status: 'trial'  },
  monthly:   { days: 30,  status: 'active' },
  quarterly: { days: 90,  status: 'active' },
  biannual:  { days: 180, status: 'active' },
  yearly:    { days: 365, status: 'active' },
};

/**
 * Devuelve la config de un periodo (días + status), o null si no es válido.
 */
function getPeriodConfig(period) {
  return PERIODS[period] || null;
}

/**
 * Calcula el fin del periodo: hoy + días del ciclo, normalizado
 * a las 08:30 UTC (03:30 Colombia) de ese día.
 *
 * @param {number} cycleDays
 * @param {Date} from - fecha base (por defecto ahora)
 * @returns {Date}
 */
function calculatePeriodEnd(cycleDays, from = new Date()) {
  const end = new Date(from.getTime() + cycleDays * 24 * 60 * 60 * 1000);
  end.setUTCHours(CUTOFF_HOUR_UTC, CUTOFF_MINUTE_UTC, 0, 0);
  return end;
}

module.exports = {
  PERIODS,
  getPeriodConfig,
  calculatePeriodEnd,
  CUTOFF_HOUR_UTC,
  CUTOFF_MINUTE_UTC,
};