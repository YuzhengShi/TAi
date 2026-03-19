import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

// Suppress libsignal session dumps that leak private keys to stdout.
// node_modules/libsignal/src/session_record.js uses hardcoded console.info/warn
// calls that print full Signal session objects including ephemeral private keys.
const _origInfo = console.info;
const _origWarn = console.warn;
const sessionDumpPattern = /^(Closing|Opening|Removing old|Migrating|Session already) session/i;
console.info = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && sessionDumpPattern.test(args[0])) return;
  _origInfo.apply(console, args);
};
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && sessionDumpPattern.test(args[0])) return;
  _origWarn.apply(console, args);
};

// Route uncaught errors through pino so they get timestamps in stderr
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});
