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
  // Debug: Log what we're getting
  const devDomainRaw = process.env.DEV_DOMAIN
  const nextPublicDevDomainRaw = process.env.NEXT_PUBLIC_DEV_DOMAIN
  const nodeEnv = process.env.NODE_ENV
  
  // Always check for production domain first (if set, use it)
  // Check both prefixed and non-prefixed versions
  const productionDomain = process.env.PRODUCTION_DOMAIN || process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN
  
  if (productionDomain && productionDomain !== 'https://your-production-domain.com' && productionDomain.trim() !== '') {
    return productionDomain.trim()
  }
  
  // Then check for dev domain (check both prefixed and non-prefixed)
  // Prioritize non-prefixed for server-side (available in API routes)
  const devDomain = process.env.DEV_DOMAIN || process.env.NEXT_PUBLIC_DEV_DOMAIN
  
  if (devDomain && devDomain.trim() !== '') {
    return devDomain.trim()
  }
  
  // Fallback: use ngrok in development, empty string in production
  const isDev = process.env.NODE_ENV === 'development'
  return isDev ? 'https://c702be487ed4.ngrok-free.app' : ''
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

