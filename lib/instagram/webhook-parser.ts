import { createLogger } from '@/lib/logger'
import { IncomingMessagingEvent } from './ingestion'

const log = createLogger('Instagram:WebhookParser')

/**
 * Parse webhook payload and extract messaging events
 */
export function parseMessagingEvents(body: any): IncomingMessagingEvent[] {
  const events: IncomingMessagingEvent[] = []

  // Handle test webhook format (from Meta Developer App panel)
  if (body.field === 'messages' && body.value) {
    const value = body.value
    if (value.message && value.message.mid) {
      events.push({
        mid: value.message.mid,
        sender_ig_id: value.sender?.id || '',
        recipient_ig_id: value.recipient?.id || '',
        timestamp: value.timestamp ? String(value.timestamp) : String(Date.now()),
        message_text: value.message.text || null,
        attachments: value.message.attachments || null,
      })
    }
  }

  // Handle actual Instagram webhook format
  if (body.object === 'instagram' && body.entry) {
    for (const entry of body.entry) {
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const msg of entry.messaging) {
          // Skip echo messages (messages we sent that Instagram echoes back)
          if (msg.message && msg.message.is_echo === true) {
            log.debug('Skipping echo message', { mid: msg.message.mid })
            continue
          }
          
          // Skip read receipts and other non-message events
          if (!msg.message || !msg.message.mid) {
            continue
          }
          
          events.push({
            mid: msg.message.mid,
            sender_ig_id: msg.sender?.id || '',
            recipient_ig_id: msg.recipient?.id || '',
            timestamp: msg.timestamp ? String(msg.timestamp) : String(Date.now()),
            message_text: msg.message.text || null,
            attachments: msg.message.attachments || null,
          })
        }
      }
    }
  }

  return events
}

/**
 * Forward parsed events to internal ingestion endpoint
 */
export async function forwardToInternalIngestion(events: IncomingMessagingEvent[]): Promise<void> {
  const internalUrl = process.env.INTERNAL_INGEST_URL || 'http://localhost:3000/api/internal/ingest-event'
  const serviceToken = process.env.INTERNAL_SERVICE_TOKEN

  if (!serviceToken) {
    log.error('INTERNAL_SERVICE_TOKEN not configured - cannot forward events')
    throw new Error('INTERNAL_SERVICE_TOKEN not configured')
  }

  // Forward each event asynchronously
  for (const event of events) {
    try {
      await fetch(internalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': serviceToken,
        },
        body: JSON.stringify(event),
      }).catch((error) => {
        log.error('Failed to forward event to internal endpoint', error, { mid: event.mid })
      })
    } catch (error) {
      log.error('Error forwarding event', error, { mid: event.mid })
    }
  }
}

