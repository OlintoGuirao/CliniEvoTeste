function formatArgs(args) {
  return args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
}

const logger = {
  info: (...args) => console.log('[INFO]', formatArgs(args)),
  warn: (...args) => console.warn('[WARN]', formatArgs(args)),
  error: (...args) => console.error('[ERROR]', formatArgs(args)),
};

module.exports = { logger };
