import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { parseMessagingEvents, forwardToInternalIngestion } from '@/lib/instagram/webhook-parser'

const log = createLogger('Webhook:Instagram')

/**
 * Instagram Graph API Webhook Handler (v24.0)
 * 
 * Handles webhook verification and event notifications from Instagram Graph API
 * Compatible with Instagram Graph API v24.0
 * 
 * GET: Webhook verification (Instagram sends hub.mode, hub.challenge, hub.verify_token)
 * POST: Webhook event notifications
 * 
 * Note: The API version is configured when subscribing to webhooks in Meta App Dashboard.
 * This endpoint is compatible with v24.0 webhook payloads.
 */

// Webhook verification token (should match the one configured in Instagram App settings)
const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFICATION_TOKEN || 'your_webhook_verify_token';

/**
 * GET handler for webhook verification
 * Instagram will send a GET request with:
 * - hub.mode: "subscribe"
 * - hub.challenge: A random string that must be echoed back
 * - hub.verify_token: The verify token you configured
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const verifyToken = searchParams.get('hub.verify_token');

    log.info('Verification request received', { mode, hasChallenge: !!challenge, hasToken: !!verifyToken })

    // Verify the mode and token
    if (mode === 'subscribe' && verifyToken === VERIFY_TOKEN) {
      log.info('Verification successful')
      
      // Return the challenge to complete verification
      return new NextResponse(challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    } else {
      log.warn('Verification failed', { mode, tokenMatch: verifyToken === VERIFY_TOKEN })
      
      return new NextResponse('Forbidden', {
        status: 403,
      })
    }
  } catch (error) {
    log.error('GET handler error', error)
    return new NextResponse('Internal Server Error', {
      status: 500,
    })
  }
}

/**
 * POST handler for webhook events
 * Instagram will send POST requests with webhook event data
 */
export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString()
  log.info('Webhook received', { timestamp: receivedAt })
  
  try {
    // Parse JSON body
    const rawBody = await request.text()
    let body
    
    if (!rawBody || rawBody.trim() === '') {
      log.warn('Empty body received')
      body = {}
    } else {
      try {
        body = JSON.parse(rawBody)
        log.info('Payload received', { payload: body })
      } catch (parseError) {
        log.error('JSON parse error', parseError, { rawBodyLength: rawBody.length })
        return new NextResponse('Invalid JSON', {
          status: 400,
        })
      }
    }

    // Instagram webhooks can have two formats:
    // 1. Test webhook format (from Meta Developer App panel):
    // {
    //   "field": "messages",
    //   "value": {
    //     "sender": {...},
    //     "recipient": {...},
    //     "timestamp": "...",
    //     "message": {...}
    //   }
    // }
    //
    // 2. Actual webhook format:
    // {
    //   "object": "instagram",
    //   "entry": [
    //     {
    //       "id": "instagram-page-id",
    //       "time": 1234567890,
    //       "messaging": [...] // For Instagram messaging
    //       "changes": [...] // For other events
    //     }
    //   ]
    // }

    // Parse messaging events from webhook payload
    const events = parseMessagingEvents(body)

    if (events.length > 0) {
      log.info('Parsed messaging events', { eventCount: events.length })
      
      // Forward events to internal ingestion endpoint (async, don't block response)
      // Use Promise.resolve().then() to ensure it doesn't block the response
      // but still catches errors properly
      Promise.resolve()
        .then(() => forwardToInternalIngestion(events))
        .catch((error) => {
          log.error('Failed to forward events to internal endpoint', error, {
            eventCount: events.length,
            eventMids: events.map(e => e.mid),
          })
        })
    } else {
      // Log non-messaging webhooks
      if (body.field && body.value) {
        log.info('Test webhook received (non-messaging)', {
          field: body.field,
          fullPayload: body,
        })
      } else if (body.object === 'instagram') {
        const entries = body.entry || []
        log.info('Instagram webhook received (non-messaging)', {
          entryCount: entries.length,
          entries: entries.map((entry: any) => ({
            id: entry.id,
            time: entry.time,
            messagingCount: entry.messaging?.length || 0,
            changesCount: entry.changes?.length || 0,
            mentionsCount: entry.mentions?.length || 0,
            storyMentionsCount: entry.story_mentions?.length || 0,
          })),
        })
      } else if (body.object) {
        log.warn('Unknown object type', { object: body.object, payload: body })
      } else {
        log.warn('No recognized webhook format detected', { payload: body })
      }
    }
    
    return new NextResponse('OK', {
      status: 200,
    })
  } catch (error) {
    log.error('POST handler error', error)

    // Still return 200 to prevent Instagram from retrying
    // (or return 500 if you want Instagram to retry)
    return new NextResponse('OK', {
      status: 200,
    })
  }
}

