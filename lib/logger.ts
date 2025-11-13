import pino from 'pino'

/**
 * Logger utility for backend API routes
 * Provides structured logging with different log levels
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
})

/**
 * Create a logger instance with a context prefix
 * @param context - Context name (e.g., 'Auth', 'Profile', 'Webhook')
 */
export function createLogger(context: string) {
  return {
    info: (message: string, data?: Record<string, any>) => {
      logger.info({ context, ...data }, message)
    },
    error: (message: string, error?: Error | any, data?: Record<string, any>) => {
      const errorData = error instanceof Error
        ? {
            error: {
              message: error.message,
              name: error.name,
              stack: error.stack,
            },
          }
        : error
          ? { error }
          : {}
      logger.error({ context, ...errorData, ...data }, message)
    },
    warn: (message: string, data?: Record<string, any>) => {
      logger.warn({ context, ...data }, message)
    },
    debug: (message: string, data?: Record<string, any>) => {
      logger.debug({ context, ...data }, message)
    },
  }
}

export default logger

