import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth/callback-log
 * 
 * Server-side logging endpoint for auth callback errors
 */
export async function POST(request: NextRequest) {
  try {
    const { error, details, hash } = await request.json()
    
    console.error('\n[Auth Callback] === SERVER-SIDE ERROR LOG ===')
    console.error('[Auth Callback] Error:', error)
    console.error('[Auth Callback] Details:', JSON.stringify(details, null, 2))
    if (hash) {
      console.error('[Auth Callback] Hash (first 200 chars):', hash.substring(0, 200))
    }
    console.error('[Auth Callback] Timestamp:', new Date().toISOString())
    console.error('[Auth Callback] === END ERROR LOG ===\n')
    
    return NextResponse.json({ logged: true })
  } catch (err) {
    console.error('[Auth Callback Log] Failed to log error:', err)
    return NextResponse.json({ logged: false }, { status: 500 })
  }
}

