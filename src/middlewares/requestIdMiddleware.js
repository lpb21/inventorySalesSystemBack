/**
 * Genera un identificador único por petición (requestId) y lo adjunta a req.
 * Sirve para rastrear en los logs todo lo que pasó durante una misma petición,
 * y para pedírselo al cliente cuando reporte un error ("¿qué id te salió?").
 * Respeta un x-request-id entrante si viene (útil si algún día hay un proxy que lo setea).
 */
const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  // Devolverlo en la respuesta permite verlo en el navegador (Network) al depurar
  res.setHeader('X-Request-Id', requestId);
  next();
};

module.exports = requestIdMiddleware;