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
  // Always check for production domain first (if set, use it)
  // Check both prefixed and non-prefixed versions
  const productionDomain = process.env.PRODUCTION_DOMAIN || process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN
  
  if (productionDomain && productionDomain !== 'https://your-production-domain.com') {
    return productionDomain
  }
  
  // Then check for dev domain (check both prefixed and non-prefixed)
  const devDomain = process.env.DEV_DOMAIN || process.env.NEXT_PUBLIC_DEV_DOMAIN
  
  if (devDomain) {
    return devDomain
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
  
  // If we have an env URL, use it; otherwise fall back to request origin
  if (envUrl) {
    return envUrl
  }
  
  return request.nextUrl.origin
}

