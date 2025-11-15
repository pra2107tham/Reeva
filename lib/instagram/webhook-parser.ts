import { createLogger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/utils/url'
import { Client } from '@upstash/qstash'
import { IncomingMessagingEvent } from './ingestion'

const log = createLogger('Instagram:WebhookParser')

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
 * Publish events directly to QStash (bypassing internal endpoint)
 * This avoids self-referencing HTTP calls and potential hanging issues
 * 
 * IMPORTANT: In serverless environments, we MUST publish before returning the response.
 * Using setImmediate() or fire-and-forget doesn't work because the execution context
 * is frozen immediately after the response is sent.
 */
export async function forwardToInternalIngestion(events: IncomingMessagingEvent[]): Promise<void> {
  const baseUrl = getBaseUrl()
  const consumerUrl = baseUrl 
    ? `${baseUrl}/api/qstash/instagram-ingestion`
    : 'http://localhost:3000/api/qstash/instagram-ingestion' // Fallback for local dev

  if (!baseUrl) {
    log.error('Base URL not configured - cannot publish to QStash')
    throw new Error('Base URL not configured')
  }

  log.info('Publishing events directly to QStash', {
    consumerUrl,
    eventCount: events.length,
    baseUrl,
    eventMids: events.map(e => e.mid),
  })

  // Publish each event with timeout to ensure webhook responds quickly
  // We MUST await these to ensure they execute before response is sent (serverless requirement)
  const publishPromises = events.map(async (event) => {
    try {
      log.info('Publishing event to QStash', {
        mid: event.mid,
        senderIgId: event.sender_ig_id,
        consumerUrl,
      })
      
      const startTime = Date.now()
      const qstash = getQStashClient()
      
      // Add timeout wrapper for QStash publish (3 seconds max)
      // Keep it short to ensure webhook responds quickly
      const qstashPublishPromise = qstash.publishJSON({
        url: consumerUrl,
        body: event,
        // Deduplication: Use Instagram message ID to prevent duplicate processing
        deduplicationId: `ig_msg_${event.mid}`,
        // Retries: Configure explicit retries
        retries: 3,
        // Label: Add label for better log filtering
        label: 'instagram-messaging-event',
        // Timeout: Set timeout for message processing (30 seconds)
        timeout: 30,
      })
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('QStash publish timeout after 3 seconds'))
        }, 3000) // 3 second timeout - Instagram expects quick responses
      })
      
      const messageId = await Promise.race([qstashPublishPromise, timeoutPromise])
      const duration = Date.now() - startTime
      
      log.info('Event published to QStash successfully', {
        mid: event.mid,
        messageId: messageId.messageId,
        duration,
        consumerUrl,
      })
    } catch (publishError: any) {
      const duration = Date.now() - Date.now()
      
      if (publishError.message?.includes('timeout')) {
        log.warn('QStash publish timed out', {
          mid: event.mid,
          consumerUrl,
          timeout: '3s',
          note: 'Webhook will still respond 200 - Instagram will retry if needed',
        })
      } else {
        log.error('Failed to publish event to QStash', publishError, {
          mid: event.mid,
          consumerUrl,
          errorMessage: publishError.message,
          errorName: publishError.name,
        })
      }
      // Don't throw - we want webhook to return 200 even if publish fails
      // Instagram will retry the webhook if we return an error
    }
  })

  // Wait for all publishes (with timeout) before returning
  // Use allSettled to ensure we don't throw even if some fail
  await Promise.allSettled(publishPromises)
}

