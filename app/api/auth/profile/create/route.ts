import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('Auth:ProfileCreate')

/**
 * POST /api/auth/profile/create
 * 
 * Creates a profile for the authenticated user (uses service role to bypass RLS)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body, handle empty body gracefully
    let full_name: string | undefined
    try {
      const body = await request.text()
      if (body) {
        const parsed = JSON.parse(body)
        full_name = parsed.full_name
      }
    } catch (err) {
      // Empty body or invalid JSON - use defaults
    }
    
    const fullName = full_name || 
                    user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    user.email?.split('@')[0] || 
                    'User'

    // Use service client to create profile (bypasses RLS)
    const serviceClient = createServiceClient()
    
    // Check if profile already exists
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json({ 
        profile: existingProfile,
        message: 'Profile already exists' 
      })
    }

    // Create profile
    const { data: profile, error: createError } = await serviceClient
      .from('profiles')
      .insert({
        id: user.id,
        full_name: fullName.trim(),
      })
      .select('id, full_name, created_at, updated_at')
      .single()

    if (createError) {
      log.error('Failed to create profile', createError, { userId: user.id })
      return NextResponse.json(
        { error: 'Failed to create profile. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    log.error('Unexpected error creating profile', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}

