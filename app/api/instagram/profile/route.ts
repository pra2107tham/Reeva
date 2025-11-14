import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('Instagram:Profile')

/**
 * GET /api/instagram/profile?ig_id=<instagram_id>
 * 
 * Fetch Instagram profile details using Instagram Graph API
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const igId = searchParams.get('ig_id')

    if (!igId) {
      return NextResponse.json(
        { error: 'Missing ig_id parameter' },
        { status: 400 }
      )
    }

    const apiBaseUrl = process.env.INSTAGRAM_API_BASE_URL
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN

    if (!apiBaseUrl || !accessToken) {
      log.error('Missing Instagram API configuration')
      return NextResponse.json(
        { error: 'Instagram API not configured' },
        { status: 500 }
      )
    }

    // Instagram Graph API endpoint for messaging users (IGBusinessScopedID)
    // Note: profile_picture_url and name are not available for messaging user IDs
    // Only id and username are available for scoped IDs
    const url = `${apiBaseUrl}/${igId}?fields=id,username`

    log.debug('Fetching Instagram profile', { igId, url })

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error('Failed to fetch Instagram profile', new Error(errorText), {
        igId,
        status: response.status,
      })
      
      // Return empty profile instead of error - profile info is optional
      // The verify page will gracefully handle missing profile data
      return NextResponse.json({
        success: true,
        profile: {
          id: igId,
          username: null,
          name: null,
          profile_picture_url: null,
        },
      })
    }

    const data = await response.json()
    
    log.info('Instagram profile fetched successfully', { 
      igId, 
      username: data.username,
    })

    return NextResponse.json({
      success: true,
      profile: {
        id: data.id || igId,
        username: data.username || null,
        name: null, // Not available for messaging user IDs
        profile_picture_url: null, // Not available for messaging user IDs
      },
    })
  } catch (error: any) {
    log.error('Failed to fetch Instagram profile', error)
    // Return empty profile instead of error - profile info is optional
    const igId = request.nextUrl.searchParams.get('ig_id')
    return NextResponse.json({
      success: true,
      profile: {
        id: igId || null,
        username: null,
        name: null,
        profile_picture_url: null,
      },
    })
  }
}

