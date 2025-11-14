import { NextRequest, NextResponse } from 'next/server'
import { send } from '@vercel/queue'
import { createLogger } from '@/lib/logger'
import { IncomingMessagingEvent } from '@/lib/instagram/ingestion'

const log = createLogger('Internal:IngestEvent')

/**
 * POST /api/internal/ingest-event
 * 
 * Internal endpoint for ingesting parsed messaging events from webhook handler
 * Enqueues events to Vercel Queue for background processing
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

    // Always use Vercel Queue (works in all environments including local dev)
    // If queue fails, fall back to direct processing
    const isLocalDev = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development'
    
    try {
      await send('instagram-ingestion', event)
      
      log.info('Event enqueued successfully', { mid: event.mid })
      
      // In local dev, trigger queue consumer manually since callbacks don't work
      if (isLocalDev) {
        const pollUrl = `${request.nextUrl.origin}/api/queues/instagram-ingestion`
        log.info('Triggering queue consumer manually (local dev)', { 
          mid: event.mid,
          pollUrl 
        })
        
        // Trigger queue consumer asynchronously (don't block response)
        fetch(pollUrl, {
          method: 'GET',
        })
        .then((response) => {
          log.info('Queue polling trigger succeeded', { 
            mid: event.mid,
            status: response.status,
            statusText: response.statusText 
          })
        })
        .catch((pollError) => {
          log.error('Queue polling trigger failed', pollError, { 
            mid: event.mid,
            pollUrl 
          })
        })
      }
      
      return NextResponse.json(
        { success: true, message: 'Event enqueued for processing' },
        { status: 200 }
      )
    } catch (queueError: any) {
      // Queue failed - fall back to direct processing
      log.error('Failed to enqueue event, falling back to direct processing', queueError, { 
        mid: event.mid 
      })
      
      // Fallback: process directly
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

