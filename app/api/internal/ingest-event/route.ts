import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { handleIncomingMessagingEvent, IncomingMessagingEvent } from '@/lib/instagram/ingestion'

const log = createLogger('Internal:IngestEvent')

/**
 * POST /api/internal/ingest-event
 * 
 * Internal endpoint for ingesting parsed messaging events from webhook handler
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

    // Parse event payload
    const event: IncomingMessagingEvent = await request.json()

    // Validate required fields
    if (!event.mid || !event.sender_ig_id || !event.recipient_ig_id || !event.timestamp) {
      log.warn('Invalid event payload', { event })
      return NextResponse.json(
        { error: 'Invalid event payload: missing required fields' },
        { status: 400 }
      )
    }

    // Process event asynchronously (don't block webhook response)
    // Fire and forget - process in background
    handleIncomingMessagingEvent(event).catch((error) => {
      log.error('Failed to process event', error, { mid: event.mid })
    })

    // Return success immediately (don't await processing)
    return NextResponse.json(
      { success: true, message: 'Event accepted for processing' },
      { status: 200 }
    )
  } catch (error: any) {
    log.error('Unexpected error in ingest-event', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

