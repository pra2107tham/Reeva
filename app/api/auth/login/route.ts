import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/auth/login
 * 
 * Handles user login with email+password or Google OAuth
 * Uses server client for auth (sets cookies) and service client for profile operations (bypasses RLS)
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, provider = 'email' } = await request.json()

    // Create server client with proper cookie handling for API routes
    let response = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // For email+password login
    if (provider === 'email') {
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password are required' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('[Login] Error:', error)
        
        // Check if error is due to unconfirmed email
        if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          return NextResponse.json(
            { error: 'Please confirm your email address before logging in. Check your inbox for the confirmation link.' },
            { status: 400 }
          )
        }
        
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      // Ensure profile exists after successful login
      // Use service client for profile operations to bypass RLS
      if (data.user) {
        const serviceClient = createServiceClient()
        
        const { data: existingProfile } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single()

        if (!existingProfile) {
          const fullName = data.user.user_metadata?.full_name || 
                          data.user.email?.split('@')[0] || 
                          'User'

          const { error: profileError } = await serviceClient
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: fullName,
            })

          if (profileError) {
            console.error('[Login] Profile creation error:', profileError)
            // Don't fail login if profile creation fails - it can be created later
          }
        }
      }

      // Create JSON response with cookies set by the server client
      const jsonResponse = NextResponse.json({
        message: 'Login successful',
        user: data.user,
      })

      // Copy cookies from the server client response to the JSON response
      response.cookies.getAll().forEach((cookie) => {
        jsonResponse.cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as 'lax' | 'strict' | 'none',
          path: cookie.path,
          maxAge: cookie.maxAge,
        })
      })

      return jsonResponse
    }

    // For Google OAuth
    if (provider === 'google') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${request.nextUrl.origin}/api/auth/callback`,
        },
      })

      if (error) {
        console.error('[Login] Google OAuth error:', error)
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        message: 'Redirecting to Google...',
        url: data.url,
      })
    }

    return NextResponse.json(
      { error: 'Invalid provider' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Login] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
