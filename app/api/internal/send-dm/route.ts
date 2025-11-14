import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { sendDM, trackOutboundMessage, updateOutboundMessage } from '@/lib/instagram/utils'

const log = createLogger('Internal:SendDM')

/**
 * POST /api/internal/send-dm
 * 
 * Send a generic DM to an Instagram user
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

    const { ig_id, message_text, kind = 'custom' } = await request.json()

    if (!ig_id || !message_text) {
      return NextResponse.json(
        { error: 'Missing required fields: ig_id, message_text' },
        { status: 400 }
      )
    }

    // Track outbound message
    const outboundMessageId = await trackOutboundMessage(
      ig_id,
      kind as 'verification' | 'acknowledgement',
      { text: message_text },
      'pending'
    )

    // Send DM with retry logic
    const maxAttempts = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { remoteMessageId } = await sendDM(ig_id, message_text)
        
        await updateOutboundMessage(outboundMessageId, {
          status: 'sent',
          remote_message_id: remoteMessageId,
          attempts: attempt,
        })

        return NextResponse.json({
          success: true,
          remote_message_id: remoteMessageId,
          outbound_message_id: outboundMessageId,
        })
      } catch (error: any) {
        lastError = error
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff, max 10s
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        await updateOutboundMessage(outboundMessageId, {
          status: attempt === maxAttempts ? 'failed' : 'pending',
          error: error.message,
          attempts: attempt,
        })
      }
    }

    throw lastError || new Error('Failed to send DM after retries')
  } catch (error: any) {
    log.error('Failed to send DM', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

