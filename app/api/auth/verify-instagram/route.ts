import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

const log = createLogger('Auth:VerifyInstagram')

/**
 * POST /api/auth/verify-instagram
 * 
 * Verify Instagram verification token and link Instagram account to user
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      log.warn('Unauthorized verification attempt', { hasUser: !!user })
      return NextResponse.json(
        { error: 'You must be logged in to verify your Instagram account' },
        { status: 401 }
      )
    }

    const { token, ig_id } = await request.json()

    if (!token || !ig_id) {
      return NextResponse.json(
        { error: 'Missing required fields: token, ig_id' },
        { status: 400 }
      )
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Use service client to query verification_tokens (bypasses RLS)
    const serviceClient = createServiceClient()

    // Find the verification token
    const { data: tokenData, error: tokenError } = await serviceClient
      .from('verification_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('ig_id', ig_id)
      .eq('consumed', false)
      .single()

    if (tokenError || !tokenData) {
      log.warn('Invalid or expired verification token', {
        hasToken: !!tokenData,
        error: tokenError?.message,
      })
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt < new Date()) {
      log.warn('Expired verification token', { expiresAt: expiresAt.toISOString() })
      return NextResponse.json(
        { error: 'Verification token has expired' },
        { status: 400 }
      )
    }

    // Mark token as consumed
    await serviceClient
      .from('verification_tokens')
      .update({ consumed: true })
      .eq('token_hash', tokenHash)

    // Link Instagram profile to user account
    const { error: updateError } = await serviceClient
      .from('instagram_profiles')
      .update({
        connected_user_id: user.id,
        connected_at: new Date().toISOString(),
      })
      .eq('ig_id', ig_id)

    if (updateError) {
      log.error('Failed to link Instagram profile', updateError, { ig_id, userId: user.id })
      return NextResponse.json(
        { error: 'Failed to link Instagram account' },
        { status: 500 }
      )
    }

    log.info('Instagram account linked successfully', {
      ig_id,
      userId: user.id,
      tokenId: tokenData.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Instagram account linked successfully',
    })
  } catch (error: any) {
    log.error('Failed to verify Instagram account', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

