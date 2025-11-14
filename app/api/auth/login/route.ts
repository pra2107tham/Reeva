import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import { getBaseUrlFromRequest } from '@/lib/utils/url'

const log = createLogger('Auth:Login')

/**
 * POST /api/auth/login
 * 
 * Handles user login with email+password or Google OAuth
 * Uses server client for auth (sets cookies) and service client for profile operations (bypasses RLS)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, provider = 'email', redirect } = body

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
        log.error('Login failed', error, { email, provider })
        
        // Check if error is due to unconfirmed email
        if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          return NextResponse.json(
            { error: 'Please confirm your email address before logging in. Check your inbox for the confirmation link.' },
            { status: 400 }
          )
        }
        
        // Return user-friendly error messages
        const errorMessage = error.message.includes('Invalid login credentials') 
          ? 'Invalid email or password. Please check your credentials and try again.'
          : error.message.includes('Too many requests')
          ? 'Too many login attempts. Please wait a few minutes and try again.'
          : 'Login failed. Please check your credentials and try again.'
        
        return NextResponse.json(
          { error: errorMessage },
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
            log.warn('Profile creation failed during login', { userId: data.user.id, error: profileError })
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
      const baseUrl = getBaseUrlFromRequest(request)
      const redirectTo = redirect 
        ? `${baseUrl}/auth/callback?redirect=${encodeURIComponent(redirect)}`
        : `${baseUrl}/auth/callback`
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (error) {
        log.error('Google OAuth initiation failed', error)
        return NextResponse.json(
          { error: 'Failed to initiate Google login. Please try again.' },
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
    log.error('Unexpected error during login', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
