import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import { getBaseUrlFromRequest } from '@/lib/utils/url'

const log = createLogger('Auth:Signup')

/**
 * POST /api/auth/signup
 * 
 * Handles user signup with email+password or Google OAuth
 * Creates a profile entry in the profiles table after successful signup
 * Sends confirmation email with magic link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, provider = 'email', redirect } = body

    const supabase = createServiceClient()

    // For email+password signup
    if (provider === 'email') {
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password are required' },
          { status: 400 }
        )
      }

      if (!full_name || full_name.trim() === '') {
        return NextResponse.json(
          { error: 'Full name is required' },
          { status: 400 }
        )
      }

      // Sign up user with email and password
      // Preserve redirect URL in email confirmation link
      const baseUrl = getBaseUrlFromRequest(request)
      const redirectParam = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name.trim(),
          },
          emailRedirectTo: `${baseUrl}/auth/callback?type=signup${redirectParam}`,
        },
      })

      if (error) {
        log.error('Signup failed', error, { email })
        
        // Return user-friendly error messages
        const errorMessage = error.message.includes('User already registered')
          ? 'An account with this email already exists. Please login instead.'
          : error.message.includes('Password')
          ? 'Password does not meet requirements. Please use a stronger password.'
          : 'Signup failed. Please check your information and try again.'
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        )
      }

      // Don't create profile here - it will be created after email confirmation
      // Profile creation happens in the callback handler after email is confirmed
      // This avoids foreign key constraint issues with unconfirmed users

      return NextResponse.json({
        message: 'Account created! Please check your email to confirm your account.',
        user: data.user,
        session: data.session, // Will be null until email is confirmed
      })
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
          { error: 'Failed to initiate Google signup. Please try again.' },
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
    log.error('Unexpected error during signup', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
