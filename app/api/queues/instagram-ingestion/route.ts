import { handleCallback, receive } from '@vercel/queue'
import { createLogger } from '@/lib/logger'
import { handleIncomingMessagingEvent, IncomingMessagingEvent } from '@/lib/instagram/ingestion'

const log = createLogger('Queue:InstagramIngestion')

/**
 * Queue consumer endpoint for Instagram messaging events
 * This endpoint processes events from the Vercel Queue
 * 
 * Route: /api/queues/instagram-ingestion
 * Configured in vercel.json to consume from 'instagram-ingestion' topic
 * 
 * In production: Uses handleCallback (automatically invoked by Vercel Queue)
 * In local dev: Can be manually polled or uses receive() for polling
 */
export const POST = handleCallback({
  'instagram-ingestion': {
    'instagram-ingestion-consumer': async (event: IncomingMessagingEvent, metadata) => {
      try {
        log.info('Processing queued event', {
          mid: event.mid,
          senderIgId: event.sender_ig_id,
          messageId: metadata.messageId,
          timestamp: new Date().toISOString(),
        })

        // Process the event
        await handleIncomingMessagingEvent(event)

        log.info('Event processed successfully', { 
          messageId: metadata.messageId, 
          mid: event.mid 
        })
        
        // Message is automatically acknowledged on successful completion
      } catch (error: any) {
        log.error('Failed to process queued event', error, {
          messageId: metadata.messageId,
          mid: event.mid,
          timestamp: new Date().toISOString(),
        })
        
        // Throw error to let Vercel Queue handle retries
        // Vercel Queue will automatically retry failed messages
        throw error
      }
    }
  }
})

/**
 * GET endpoint for manual polling in local development
 * This allows manually triggering queue consumption when callbacks don't work
 */
export async function GET() {
  // Only allow manual polling in local dev
  const isLocalDev = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development'
  
  if (!isLocalDev) {
    return new Response('Manual polling only available in local development', { status: 403 })
  }

  try {
    log.info('Manual queue polling triggered (local dev)')
    
    // Poll for messages using receive()
    await receive<IncomingMessagingEvent>(
      'instagram-ingestion',
      'instagram-ingestion-consumer',
      async (message) => {
        try {
          const event = message.body
          log.info('Processing queued event (manual poll)', {
            mid: event.mid,
            senderIgId: event.sender_ig_id,
            messageId: message.id,
            timestamp: new Date().toISOString(),
          })

          // Process the event
          await handleIncomingMessagingEvent(event)

          log.info('Event processed successfully (manual poll)', { 
            messageId: message.id, 
            mid: event.mid 
          })
        } catch (error: any) {
          log.error('Failed to process queued event (manual poll)', error, {
            messageId: message.id,
            mid: message.body?.mid,
            timestamp: new Date().toISOString(),
          })
          throw error
        }
      },
      {
        // Only consume one message at a time for manual polling
        limit: 1,
      }
    )

    return new Response('Queue polled successfully', { status: 200 })
  } catch (error: any) {
    // QueueEmptyError is expected when no messages are available
    if (error.name === 'QueueEmptyError' || error.message?.includes('empty')) {
      log.debug('No messages in queue (manual poll)')
      return new Response('No messages in queue', { status: 200 })
    }
    
    log.error('Manual queue polling error', error)
    return new Response(`Queue polling error: ${error.message}`, { status: 500 })
  }
}

