/**
 * Paquetes de SMS prepago (se venden aparte de la suscripción).
 * Costo real de referencia: ~200 COP por SMS (tasa del 28/09/2026).
 * El margen cubre la variación del dólar y la comisión bancaria al pagar Twilio.
 */
const SMS_PACKAGES = {
  small: { code: 'small', name: 'Pequeño', credits: 50, price_cop: 13000 },
  medium: { code: 'medium', name: 'Mediano', credits: 150, price_cop: 37000 },
  large: { code: 'large', name: 'Grande', credits: 300, price_cop: 72000 },
  xlarge: { code: 'xlarge', name: 'Extra grande', credits: 600, price_cop: 138000 },
};

// Bono de bienvenida: lo otorga el superadmin, una sola vez por tenant.
const SMS_WELCOME_BONUS = 10;

const listSmsPackages = () => Object.values(SMS_PACKAGES);

module.exports = { SMS_PACKAGES, SMS_WELCOME_BONUS, listSmsPackages };
