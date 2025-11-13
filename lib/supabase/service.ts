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
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    log.error('Missing environment variables', new Error('Missing Supabase environment variables'), {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
    })
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.')
  }

  // Create client with service role key - this bypasses RLS automatically
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    // Ensure we're using the service role
    db: {
      schema: 'public'
    }
  })
}

