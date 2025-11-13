import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/profile
 * 
 * Fetches the authenticated user's profile
 */
export async function GET(request: NextRequest) {
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

    // Fetch profile (RLS ensures user can only access their own profile)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        const fullName = user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.email?.split('@')[0] || 
                        'User'

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: fullName,
          })
          .select('id, full_name, created_at, updated_at')
          .single()

        if (createError) {
          console.error('[Profile] Error creating profile:', createError)
          return NextResponse.json(
            { error: 'Failed to create profile' },
            { status: 500 }
          )
        }

        return NextResponse.json({ profile: newProfile })
      }

      console.error('[Profile] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('[Profile] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/auth/profile
 * 
 * Updates the authenticated user's profile
 */
export async function PATCH(request: NextRequest) {
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

    const { full_name } = await request.json()

    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      )
    }

    // Update profile (RLS ensures user can only update their own profile)
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim() })
      .eq('id', user.id)
      .select('id, full_name, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('[Profile] Error updating profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 400 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('[Profile] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

