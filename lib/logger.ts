import winston from 'winston'

/**
 * Logger utility for backend API routes
 * Uses Winston for structured logging with enhanced formatting
 */

// Custom format for pretty console output with enhanced colors and spacing
const consoleFormat = winston.format.printf((info) => {
  const { timestamp, level, message, context, metadata } = info
  
  // Format timestamp (dim gray)
  const timestampStr = `\x1b[90m${timestamp}\x1b[0m`
  
  // Format context (bright cyan, bold) with spacing
  const contextStr = context ? ` \x1b[96m\x1b[1m[${context}]\x1b[0m` : ''
  
  // Format metadata with indentation and colors
  let metaStr = ''
  if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
    // Remove service from metadata if present
    const metaObj = metadata as Record<string, any>
    const { service, ...restMeta } = metaObj
    if (Object.keys(restMeta).length > 0) {
      const metaJson = JSON.stringify(restMeta, null, 2)
      // Indent each line of metadata with proper spacing
      const indentedMeta = metaJson
        .split('\n')
        .map((line, index) => {
          if (index === 0) return `\x1b[90m${line}\x1b[0m`
          return `    \x1b[90m${line}\x1b[0m`
        })
        .join('\n')
      metaStr = `\n    ${indentedMeta}`
    }
  }
  
  // Format error stack trace if present with red coloring
  let stackStr = ''
  if (info.stack && typeof info.stack === 'string') {
    const stackLines = info.stack.split('\n')
    const formattedStack = stackLines
      .map((line: string, index: number) => {
        if (index === 0) {
          return `\x1b[31m${line}\x1b[0m`
        }
        return `    \x1b[90m${line}\x1b[0m`
      })
      .join('\n')
    stackStr = `\n    ${formattedStack}`
  }
  
  // Combine all parts with proper spacing
  // Format: timestamp level [context] message
  const mainLine = [
    timestampStr,
    level,
    contextStr,
    message,
  ].filter(Boolean).join(' ')
  
  // Append metadata and stack on new lines
  return [mainLine, metaStr, stackStr].filter(Boolean).join('')
})

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'context', 'stack'] })
  ),
  defaultMeta: { service: 'reeva-api' },
  transports: [
    // Write all logs to console with enhanced formatting
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ 
          level: true,
          message: false,
          colors: {
            error: 'red',
            warn: 'yellow',
            info: 'green',
            debug: 'blue',
          }
        }),
        consoleFormat
      ),
    }),
  ],
})

/**
 * Create a logger instance with a context prefix
 * @param context - Context name (e.g., 'Auth', 'Profile', 'Webhook')
 */
export function createLogger(context: string) {
  return {
    info: (message: string, data?: Record<string, any>) => {
      logger.info(message, { context, ...data })
    },
    error: (message: string, error?: Error | any, data?: Record<string, any>) => {
      if (error instanceof Error) {
        logger.error(message, {
          context,
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          ...data,
        })
      } else if (error) {
        logger.error(message, { context, error, ...data })
      } else {
        logger.error(message, { context, ...data })
      }
    },
    warn: (message: string, data?: Record<string, any>) => {
      logger.warn(message, { context, ...data })
    },
    debug: (message: string, data?: Record<string, any>) => {
      logger.debug(message, { context, ...data })
    },
  }
}

export default logger
