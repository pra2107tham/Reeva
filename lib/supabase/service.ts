import { createClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('Supabase:Service')

/**
 * Service role client for backend operations
 * Uses service role key to bypass RLS policies
 * 
 * Note: When using the service role key, RLS is automatically bypassed.
 * The service role key has full access to all tables regardless of RLS policies.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    log.error('Missing environment variables', new Error('Missing Supabase environment variables'), {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlValue: supabaseUrl ? 'set' : 'missing',
      keyValue: supabaseServiceKey ? 'set' : 'missing',
      nodeEnv: process.env.NODE_ENV,
    })
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.')
  }

  log.debug('Creating Supabase service client', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseServiceKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseServiceKey?.length || 0,
  })

  // Create client with service role key - this bypasses RLS automatically
  // Configure for serverless environments with proper timeouts
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    // Ensure we're using the service role
    db: {
      schema: 'public'
    },
    // Add global fetch with timeout for serverless environments
    // This ensures all Supabase requests have a timeout
    global: {
      fetch: async (url, options = {}) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, 12000) // 12 second timeout (less than our 15s to catch it)
        
        try {
          const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        return response
        } catch (error: any) {
          clearTimeout(timeoutId)
          if (error.name === 'AbortError') {
            throw new Error(`Supabase request timed out after 12 seconds: ${url}`)
          }
          throw error
        }
      }
    }
  })
}

