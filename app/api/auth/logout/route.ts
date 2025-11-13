import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('Auth:Logout')

/**
 * POST /api/auth/logout
 * 
 * Logs out the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.signOut()

    if (error) {
      log.error('Logout failed', error)
      return NextResponse.json(
        { error: 'Failed to logout. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Logged out successfully' })
  } catch (error) {
    log.error('Unexpected error during logout', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}

