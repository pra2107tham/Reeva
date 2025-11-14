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

    // Instagram Graph API endpoint - query user ID directly
    // Fields: id, username, name, profile_pic
    // Note: Requires instagram_business_basic permission
    const url = `${apiBaseUrl}/${igId}?fields=id,username,name,profile_pic`

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
      hasName: !!data.name,
      hasProfilePic: !!data.profile_pic,
    })

    return NextResponse.json({
      success: true,
      profile: {
        id: data.id || igId,
        username: data.username || null,
        name: data.name || null, // Maps to display_name in database
        profile_picture_url: data.profile_pic || null, // Maps to profile_pic_url in database
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

