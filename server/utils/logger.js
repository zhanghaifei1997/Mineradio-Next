const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel = levels[process.env.LOG_LEVEL || 'info'] ?? levels.info

function format(prefix, args) {
  const timestamp = new Date().toISOString()
  return [`[${timestamp}] [${prefix}]`, ...args]
}

export const logger = {
  debug(...args) {
    if (currentLevel <= levels.debug) {
      console.debug(...format('DEBUG', args))
    }
  },
  info(...args) {
    if (currentLevel <= levels.info) {
      console.info(...format('INFO', args))
    }
  },
  warn(...args) {
    if (currentLevel <= levels.warn) {
      console.warn(...format('WARN', args))
    }
  },
  error(...args) {
    if (currentLevel <= levels.error) {
      console.error(...format('ERROR', args))
    }
  },
}
