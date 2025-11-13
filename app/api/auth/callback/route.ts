import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/auth/callback
 * 
 * Handles OAuth callback from Google (with code parameter)
 * Email confirmation links are handled by /auth/callback page (client-side)
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') || '/profile'

  const supabase = createServiceClient()

  // Handle OAuth callback (Google) or email confirmation with code parameter
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] Session exchange error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    // Ensure profile exists
    if (data.user) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existingProfile) {
        const fullName = data.user.user_metadata?.full_name || 
                        data.user.user_metadata?.name || 
                        data.user.email?.split('@')[0] || 
                        'User'

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
          })

        if (profileError) {
          console.error('[Auth Callback] Profile creation error:', profileError)
        }
      }
    }

    // Redirect based on type
    if (type === 'signup') {
      return NextResponse.redirect(`${requestUrl.origin}/login?success=${encodeURIComponent('Email confirmed! You can now login.')}`)
    }

    // Redirect to profile page
    return NextResponse.redirect(`${requestUrl.origin}${next}`)
  }

  // If no code, redirect to client-side callback page (for hash fragment handling)
  return NextResponse.redirect(`${requestUrl.origin}/auth/callback${requestUrl.search}`)
}
