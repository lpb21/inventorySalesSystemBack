const env = require('../config/env');

const LEVELS = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
};

function serializeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return '';
  }

  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return '';
  }

  return entries.map(([key, value]) => {
    if (value instanceof Error) {
      return `${key}="${value.message}"`;
    }

    if (typeof value === 'object') {
      return `${key}='${JSON.stringify(value)}'`;
    }

    return `${key}="${String(value)}"`;
  }).join(' ');
}

function write(level, scope, message, meta) {
  if (level === 'debug' && env.nodeEnv !== 'development') {
    return;
  }

  const timestamp = new Date().toISOString();
  const suffix = serializeMeta(meta);
  const line = `${timestamp} ${LEVELS[level]} [${scope}] ${message}${suffix ? ` ${suffix}` : ''}`;

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

module.exports = {
  error(scope, message, meta) {
    write('error', scope, message, meta);
  },
  warn(scope, message, meta) {
    write('warn', scope, message, meta);
  },
  info(scope, message, meta) {
    write('info', scope, message, meta);
  },
  debug(scope, message, meta) {
    write('debug', scope, message, meta);
  },
};
