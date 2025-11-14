import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { createLogger } from '@/lib/logger'
import { handleIncomingMessagingEvent, IncomingMessagingEvent } from '@/lib/instagram/ingestion'

const log = createLogger('QStash:InstagramIngestion')

/**
 * Determine if an error is retryable or permanent
 * Retryable errors: network issues, timeouts, temporary database issues
 * Permanent errors: validation errors, authentication errors, business logic errors
 */
function isRetryableError(error: any): boolean {
  // Database timeout errors are retryable
  if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
    return true
  }
  
  // Network errors are retryable
  if (error?.name === 'FetchError' || error?.name === 'NetworkError') {
    return true
  }
  
  // Validation errors are NOT retryable
  if (error?.message?.includes('Invalid') || error?.message?.includes('validation')) {
    return false
  }
  
  // Authentication errors are NOT retryable
  if (error?.message?.includes('Unauthorized') || error?.message?.includes('authentication')) {
    return false
  }
  
  // Default: assume retryable for transient failures
  // Most processing errors (database, API calls) are retryable
  return true
}

/**
 * Handler function for processing QStash messages
 * This is wrapped by verifySignatureAppRouter for signature verification
 */
async function handler(request: NextRequest) {
  try {
    // Parse event payload
    const event: IncomingMessagingEvent = await request.json()

    // Validate required fields
    if (!event.mid || !event.sender_ig_id || !event.recipient_ig_id || !event.timestamp) {
      log.warn('Invalid event payload from QStash', { event })
      // Return 400 for invalid payloads - QStash won't retry on 4xx errors
      // This prevents infinite retries for malformed messages
      return NextResponse.json(
        { error: 'Invalid event payload: missing required fields' },
        { status: 400 }
      )
    }

    log.info('Processing QStash message', {
      mid: event.mid,
      senderIgId: event.sender_ig_id,
      recipientIgId: event.recipient_ig_id,
    })

    // Process the event
    try {
      const result = await handleIncomingMessagingEvent(event)
      
      log.info('QStash message processed successfully', { 
        mid: event.mid,
        result 
      })

      // Return 200 to acknowledge successful processing
      // QStash will not retry on 2xx responses
      return NextResponse.json(
        { success: true, message: 'Event processed successfully' },
        { status: 200 }
      )
    } catch (processError: any) {
      log.error('Failed to process QStash message', processError, {
        mid: event.mid,
        errorName: processError.name,
        errorMessage: processError.message,
        // Include retry information if available from QStash headers
        retryCount: request.headers.get('upstash-retry-count'),
      })

      // Determine if this is a retryable error or a permanent failure
      // Permanent failures (e.g., validation errors) should return 4xx to prevent retries
      // Transient failures (e.g., database timeouts) should return 5xx to trigger retries
      const isRetryable = isRetryableError(processError)
      
      if (!isRetryable) {
        // Permanent failure - return 400 to prevent retries
        log.warn('Permanent failure detected, preventing retries', {
          mid: event.mid,
          errorType: processError.name,
        })
        return NextResponse.json(
          { error: 'Permanent failure', message: processError.message },
          { status: 400 }
        )
      }

      // Transient failure - return 500 to trigger QStash retry
      // QStash will automatically retry failed messages with exponential backoff
      return NextResponse.json(
        { error: 'Failed to process event', message: processError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    log.error('Unexpected error in QStash consumer handler', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/qstash/instagram-ingestion
 * 
 * QStash consumer endpoint for Instagram messaging events
 * Receives messages from QStash and processes them
 * verifySignatureAppRouter wraps the handler to verify message signatures
 * 
 * Signature verification ensures:
 * - Message is from QStash (not spoofed)
 * - Message hasn't been tampered with
 * - Message is not a replay attack
 */
export const POST = verifySignatureAppRouter(handler, {
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
})

