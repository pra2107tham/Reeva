import { NextRequest, NextResponse } from 'next/server';

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

    console.log('[Instagram Webhook] Verification request received:', {
      mode,
      challenge,
      verifyToken,
      timestamp: new Date().toISOString(),
    });

    // Verify the mode and token
    if (mode === 'subscribe' && verifyToken === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verification successful');
      
      // Return the challenge to complete verification
      return new NextResponse(challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    } else {
      console.error('[Instagram Webhook] Verification failed:', {
        mode,
        verifyToken,
        expectedToken: VERIFY_TOKEN,
      });
      
      return new NextResponse('Forbidden', {
        status: 403,
      });
    }
  } catch (error) {
    console.error('[Instagram Webhook] GET Error:', error);
    return new NextResponse('Internal Server Error', {
      status: 500,
    });
  }
}

/**
 * POST handler for webhook events
 * Instagram will send POST requests with webhook event data
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const rawBody = await request.text();
    let body;
    
    if (!rawBody || rawBody.trim() === '') {
      console.warn('[Instagram Webhook] Empty body received');
      body = {};
    } else {
      try {
        body = JSON.parse(rawBody);
      } catch (parseError) {
        console.error('[Instagram Webhook] JSON parse error:', parseError);
        return new NextResponse('Invalid JSON', {
          status: 400,
        });
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

    // Handle test webhook format (from Meta Developer App panel)
    if (body.field && body.value) {
      const value = body.value;
      console.log(`[Instagram Webhook] Test webhook - Field: ${body.field} | Sender: ${value.sender?.id} | Recipient: ${value.recipient?.id} | Message: ${value.message?.text || 'N/A'}`);
      return new NextResponse('OK', {
        status: 200,
      });
    }
    
    // Handle actual Instagram webhook format
    if (body.object === 'instagram') {
      const entries = body.entry || [];

      entries.forEach((entry: any) => {
        // Handle messaging events
        if (entry.messaging && Array.isArray(entry.messaging)) {
          entry.messaging.forEach((msg: any) => {
            const timestamp = msg.timestamp ? new Date(msg.timestamp).toISOString() : 'N/A';
            console.log(`[Instagram Webhook] Message | Sender: ${msg.sender?.id} | Recipient: ${msg.recipient?.id} | Text: ${msg.message?.text || 'N/A'} | Time: ${timestamp}`);
          });
        }

        // Handle changes events (comments, mentions, etc.)
        if (entry.changes && Array.isArray(entry.changes)) {
          entry.changes.forEach((change: any) => {
            console.log(`[Instagram Webhook] Change | Field: ${change.field} | Value: ${JSON.stringify(change.value)}`);
          });
        }

        // Handle mentions
        if (entry.mentions && Array.isArray(entry.mentions)) {
          entry.mentions.forEach((mention: any) => {
            console.log(`[Instagram Webhook] Mention | Media ID: ${mention.media_id} | User: ${mention.user_id}`);
          });
        }

        // Handle story mentions
        if (entry.story_mentions && Array.isArray(entry.story_mentions)) {
          entry.story_mentions.forEach((storyMention: any) => {
            console.log(`[Instagram Webhook] Story Mention | Media ID: ${storyMention.media_id} | User: ${storyMention.user_id}`);
          });
        }
      });
    } else if (body.object) {
      console.log(`[Instagram Webhook] Unknown object type: ${body.object}`);
    }
    return new NextResponse('OK', {
      status: 200,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[Instagram Webhook] Error: ${error.message}`);
    } else {
      console.error('[Instagram Webhook] Unknown error:', error);
    }

    // Still return 200 to prevent Instagram from retrying
    // (or return 500 if you want Instagram to retry)
    return new NextResponse('OK', {
      status: 200,
    });
  }
}

