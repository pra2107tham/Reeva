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

    // Fetch Instagram profile details from Instagram Graph API
    const instagramApiBaseUrl = process.env.INSTAGRAM_API_BASE_URL
    const instagramAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    
    let profileData: { username?: string; name?: string; profile_picture_url?: string } = {}
    
    if (instagramApiBaseUrl && instagramAccessToken) {
      try {
        log.info('Fetching Instagram profile details', { ig_id })
        const profileUrl = `${instagramApiBaseUrl}/${ig_id}?fields=id,username,name,profile_picture_url`
        const profileResponse = await fetch(profileUrl, {
          headers: {
            Authorization: `Bearer ${instagramAccessToken}`,
          },
        })

        if (profileResponse.ok) {
          const profileJson = await profileResponse.json()
          profileData.username = profileJson.username || null
          // Note: name and profile_picture_url are not available for messaging user IDs
          // They're only available for Instagram Business Account IDs
          log.info('Instagram profile details fetched', {
            ig_id,
            username: profileData.username,
          })
        } else {
          const errorText = await profileResponse.text()
          log.warn('Failed to fetch Instagram profile details', {
            ig_id,
            status: profileResponse.status,
            error: errorText,
          })
          // Continue without profile data - connection will still work
        }
      } catch (profileError: any) {
        log.warn('Error fetching Instagram profile details', { ig_id, profileError })
        // Continue without profile data - connection will still work
      }
    } else {
      log.warn('Instagram API credentials not configured, skipping profile fetch', {
        hasBaseUrl: !!instagramApiBaseUrl,
        hasAccessToken: !!instagramAccessToken,
      })
    }

    // Link Instagram profile to user account and update profile data
    const updateData: any = {
      connected_user_id: user.id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Add profile data if available
    if (profileData.username) {
      updateData.username = profileData.username
    }
    if (profileData.name) {
      updateData.name = profileData.name
    }
    if (profileData.profile_picture_url) {
      updateData.profile_picture_url = profileData.profile_picture_url
    }

    const { error: updateError } = await serviceClient
      .from('instagram_profiles')
      .update(updateData)
      .eq('ig_id', ig_id)

    if (updateError) {
      log.error('Failed to link Instagram profile', updateError, { ig_id, userId: user.id, updateData })
      return NextResponse.json(
        { error: 'Failed to link Instagram account' },
        { status: 500 }
      )
    }

    log.info('Instagram account linked successfully', {
      ig_id,
      userId: user.id,
      tokenId: tokenData.id,
      username: profileData.username,
      hasDisplayName: !!profileData.name,
      hasProfilePic: !!profileData.profile_picture_url,
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

