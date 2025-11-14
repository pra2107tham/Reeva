/**
 * Get the base URL for the application
 * Uses environment variables to determine the correct domain
 * - Dev: DEV_DOMAIN or NEXT_PUBLIC_DEV_DOMAIN or falls back to ngrok domain
 * - Prod: PRODUCTION_DOMAIN or NEXT_PUBLIC_PRODUCTION_DOMAIN
 * 
 * Note: Server-side code should use non-prefixed vars (DEV_DOMAIN, PRODUCTION_DOMAIN)
 * Client-side code can use NEXT_PUBLIC_ prefixed vars
 */
export function getBaseUrl(): string {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'
  
  if (isProduction) {
    // In production, use production domain
    // Check both prefixed and non-prefixed versions
    const productionDomain = process.env.PRODUCTION_DOMAIN || process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN
    
    if (productionDomain && productionDomain !== 'https://your-production-domain.com' && productionDomain.trim() !== '') {
      return productionDomain.trim()
    }
    
    // If no production domain configured, return empty string (should be configured!)
    return ''
  } else {
    // In development, use dev domain
    // Check both prefixed and non-prefixed versions
    // Prioritize non-prefixed for server-side (available in API routes)
    const devDomain = process.env.DEV_DOMAIN || process.env.NEXT_PUBLIC_DEV_DOMAIN
    
    if (devDomain && devDomain.trim() !== '') {
      return devDomain.trim()
    }
    
    // Fallback: use ngrok in development
    return 'https://c702be487ed4.ngrok-free.app'
  }
}

/**
 * Get the base URL from request (fallback to env-based URL)
 */
export function getBaseUrlFromRequest(request: { nextUrl: { origin: string } }): string {
  const envUrl = getBaseUrl()
  
  // Always prefer env URL if available (for server-side API routes)
  // This ensures we use the configured domain instead of request origin
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim()
  }
  
  // Fallback to request origin only if no env URL is configured
  return request.nextUrl.origin
}

