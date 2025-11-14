import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@upstash/qstash'
import { createLogger } from '@/lib/logger'
import { IncomingMessagingEvent } from '@/lib/instagram/ingestion'
import { getBaseUrl } from '@/lib/utils/url'

const log = createLogger('Internal:IngestEvent')

/**
 * Initialize QStash client
 */
function getQStashClient(): Client {
  const qstashToken = process.env.QSTASH_TOKEN
  const qstashUrl = process.env.QSTASH_URL

  if (!qstashToken) {
    throw new Error('QSTASH_TOKEN not configured')
  }

  return new Client({
    token: qstashToken,
    ...(qstashUrl && { baseUrl: qstashUrl }),
  })
}

/**
 * POST /api/internal/ingest-event
 * 
 * Internal endpoint for ingesting parsed messaging events from webhook handler
 * Enqueues events to QStash for asynchronous processing
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

    // Get consumer URL (public URL that QStash can reach)
    const baseUrl = getBaseUrl()
    if (!baseUrl) {
      log.error('Base URL not configured - cannot enqueue to QStash')
      return NextResponse.json(
        { error: 'Base URL not configured' },
        { status: 500 }
      )
    }

    const consumerUrl = `${baseUrl}/api/qstash/instagram-ingestion`

    try {
      // Enqueue event to QStash for asynchronous processing
      const qstash = getQStashClient()
      
      // Use Instagram message ID as deduplication ID to prevent duplicate processing
      // QStash stores deduplication IDs for 90 days
      const messageId = await qstash.publishJSON({
        url: consumerUrl,
        body: event,
        // Deduplication: Use Instagram message ID to prevent duplicate processing
        // If the same message is enqueued again within 90 days, QStash will accept but not enqueue
        deduplicationId: `ig_msg_${event.mid}`,
        // Retries: Configure explicit retries (default is 3, but being explicit)
        // Critical operations should have more retries, but 3 is reasonable for message processing
        retries: 3,
        // Label: Add label for better log filtering in QStash dashboard
        label: 'instagram-messaging-event',
        // Timeout: Set timeout for message processing (30 seconds)
        // This ensures messages don't hang indefinitely
        timeout: 30,
      })

      log.info('Event enqueued to QStash successfully', { 
        mid: event.mid,
        messageId,
        consumerUrl,
        deduplicationId: `ig_msg_${event.mid}`,
      })

      return NextResponse.json(
        { success: true, message: 'Event enqueued for processing', messageId },
        { status: 200 }
      )
    } catch (qstashError: any) {
      log.error('Failed to enqueue event to QStash, falling back to direct processing', qstashError, { 
        mid: event.mid,
        consumerUrl 
      })

      // Fallback: process directly if QStash fails
      // Import dynamically to avoid circular dependencies
      const { handleIncomingMessagingEvent } = await import('@/lib/instagram/ingestion')
      
      // Process in background (fire and forget)
      handleIncomingMessagingEvent(event).catch((error) => {
        log.error('Fallback processing failed', error, { mid: event.mid })
      })

      return NextResponse.json(
        { success: true, message: 'Event accepted (fallback mode)' },
        { status: 200 }
      )
    }
  } catch (error: any) {
    log.error('Unexpected error in ingest-event', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

