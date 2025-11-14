import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createVerificationToken } from '@/lib/instagram/utils'

const log = createLogger('Internal:GenerateVerification')

/**
 * POST /api/internal/generate-verification
 * 
 * Generate a verification token for an Instagram profile
 * Requires service token authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Validate service token
    const serviceToken = request.headers.get('x-service-token')
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN

    if (!expectedToken) {
      log.error('INTERNAL_SERVICE_TOKEN not configured')
      return NextResponse.json(
        { error: 'Service token not configured' },
        { status: 500 }
      )
    }

    if (serviceToken !== expectedToken) {
      log.warn('Invalid service token', { hasToken: !!serviceToken })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { ig_id, event_id } = await request.json()

    if (!ig_id || !event_id) {
      return NextResponse.json(
        { error: 'Missing required fields: ig_id, event_id' },
        { status: 400 }
      )
    }

    const result = await createVerificationToken(ig_id, event_id)

    // Return only token hash and expires_at (never return plaintext token via API)
    return NextResponse.json({
      token_hash: result.tokenHash,
      expires_at: result.expiresAt,
      ig_id,
    })
  } catch (error: any) {
    log.error('Failed to generate verification token', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

