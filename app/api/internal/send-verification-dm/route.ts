import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { sendVerificationDM } from '@/lib/instagram/utils'

const log = createLogger('Internal:SendVerificationDM')

/**
 * POST /api/internal/send-verification-dm
 * 
 * Send verification DM to an Instagram user
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

    const { ig_id, token_plain } = await request.json()

    if (!ig_id || !token_plain) {
      return NextResponse.json(
        { error: 'Missing required fields: ig_id, token_plain' },
        { status: 400 }
      )
    }

    const result = await sendVerificationDM(ig_id, token_plain)

    return NextResponse.json({
      success: true,
      remote_message_id: result.remoteMessageId,
      outbound_message_id: result.outboundMessageId,
    })
  } catch (error: any) {
    log.error('Failed to send verification DM', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

