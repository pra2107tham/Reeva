import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/auth/signup
 * 
 * Handles user signup with email+password or Google OAuth
 * Creates a profile entry in the profiles table after successful signup
 * Sends confirmation email with magic link
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, provider = 'email' } = await request.json()

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name.trim(),
          },
          emailRedirectTo: `${request.nextUrl.origin}/auth/callback?type=signup`,
        },
      })

      if (error) {
        console.error('[Signup] Error:', error)
        return NextResponse.json(
          { error: error.message },
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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${request.nextUrl.origin}/api/auth/callback`,
        },
      })

      if (error) {
        console.error('[Signup] Google OAuth error:', error)
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
    console.error('[Signup] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
