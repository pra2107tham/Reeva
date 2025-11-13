import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('Auth:CallbackLog')

/**
 * POST /api/auth/callback-log
 * 
 * Server-side logging endpoint for auth callback errors
 */
export async function POST(request: NextRequest) {
  try {
    const { error, details, hash, url } = await request.json()
    
    log.error('Client-side callback error', new Error(error), {
      details,
      hashPreview: hash ? hash.substring(0, 200) : undefined,
      url,
    })
    
    return NextResponse.json({ logged: true })
  } catch (err) {
    log.error('Failed to log callback error', err)
    return NextResponse.json({ logged: false }, { status: 500 })
  }
}

