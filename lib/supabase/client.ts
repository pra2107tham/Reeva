import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Only NEXT_PUBLIC_ prefixed vars are available in the browser
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase Client] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlValue: supabaseUrl ? 'set' : 'missing',
      keyValue: supabaseAnonKey ? 'set' : 'missing',
    })
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.')
  }

  // createBrowserClient automatically handles cookies for SSR
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

