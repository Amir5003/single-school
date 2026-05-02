const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'cookie'];

/**
 * Recursively redact sensitive keys from objects so they are never logged.
 */
const sanitize = (args) =>
  args.map((arg) => {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      const sanitized = { ...arg };
      SENSITIVE_FIELDS.forEach((field) => {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]';
        }
      });
      return sanitized;
    }
    return arg;
  });

const prefix = () => `[${new Date().toISOString()}]`;

const logger = {
  info: (...args) => console.log(prefix(), ...sanitize(args)),
  warn: (...args) => console.warn(prefix(), ...sanitize(args)),
  error: (...args) => console.error(prefix(), ...sanitize(args)),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(prefix(), ...sanitize(args));
    }
  },
};

module.exports = logger;
