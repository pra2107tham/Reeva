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
  // Log that POST request was received - this should ALWAYS log if the endpoint is hit
  console.log('='.repeat(80));
  console.log('[Instagram Webhook] POST request received at:', new Date().toISOString());
  console.log('[Instagram Webhook] Request method:', request.method);
  console.log('[Instagram Webhook] Request URL:', request.url);
  console.log('[Instagram Webhook] Content-Type:', request.headers.get('content-type'));
  console.log('[Instagram Webhook] Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('='.repeat(80));

  try {
    // Get raw body text first for debugging (can only read body once)
    const rawBody = await request.text();
    console.log('[Instagram Webhook] Raw body length:', rawBody?.length || 0);
    console.log('[Instagram Webhook] Raw body preview:', rawBody ? `${rawBody.substring(0, 500)}${rawBody.length > 500 ? '...' : ''}` : 'EMPTY');
    
    // Parse JSON
    let body;
    if (!rawBody || rawBody.trim() === '') {
      console.warn('[Instagram Webhook] Empty body received');
      body = {};
    } else {
      try {
        body = JSON.parse(rawBody);
        console.log('[Instagram Webhook] JSON parsed successfully');
      } catch (parseError) {
        console.error('[Instagram Webhook] JSON parse error:', parseError);
        console.error('[Instagram Webhook] Raw body that failed to parse:', rawBody);
        return new NextResponse('Invalid JSON', {
          status: 400,
        });
      }
    }
    
    // Log the complete webhook payload
    console.log('='.repeat(80));
    console.log('[Instagram Webhook] Parsed payload:', JSON.stringify(body, null, 2));
    console.log('[Instagram Webhook] Payload object type:', body.object);
    console.log('[Instagram Webhook] Payload keys:', Object.keys(body));
    console.log('='.repeat(80));

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
      console.log('[Instagram Webhook] Test webhook format detected');
      console.log('[Instagram Webhook] Field:', body.field);
      console.log('[Instagram Webhook] Value:', JSON.stringify(body.value, null, 2));
      
      // Log test webhook details
      if (body.value.sender) {
        console.log('[Instagram Webhook] Sender ID:', body.value.sender.id);
      }
      if (body.value.recipient) {
        console.log('[Instagram Webhook] Recipient ID:', body.value.recipient.id);
      }
      if (body.value.timestamp) {
        console.log('[Instagram Webhook] Timestamp:', body.value.timestamp);
        console.log('[Instagram Webhook] Timestamp (parsed):', new Date(parseInt(body.value.timestamp) * 1000).toISOString());
      }
      if (body.value.message) {
        console.log('[Instagram Webhook] Message:', JSON.stringify(body.value.message, null, 2));
        if (body.value.message.text) {
          console.log('[Instagram Webhook] Message text:', body.value.message.text);
        }
        if (body.value.message.mid) {
          console.log('[Instagram Webhook] Message ID:', body.value.message.mid);
        }
      }
      
      console.log('[Instagram Webhook] Test webhook processed successfully');
      return new NextResponse('OK', {
        status: 200,
      });
    }
    
    // Handle actual Instagram webhook format
    if (body.object === 'instagram') {
      const entries = body.entry || [];
      
      console.log(`[Instagram Webhook] Processing ${entries.length} entry/entries`);

      entries.forEach((entry: any, index: number) => {
        console.log(`\n[Instagram Webhook] Entry ${index + 1}:`, {
          id: entry.id,
          time: entry.time,
          timestamp: entry.time ? new Date(entry.time * 1000).toISOString() : 'N/A',
        });

        // Handle messaging events
        if (entry.messaging && Array.isArray(entry.messaging)) {
          console.log(`[Instagram Webhook] Found ${entry.messaging.length} messaging event(s)`);
          entry.messaging.forEach((message: any, msgIndex: number) => {
            console.log(`[Instagram Webhook] Messaging event ${msgIndex + 1}:`, JSON.stringify(message, null, 2));
          });
        }

        // Handle changes events (for other Instagram events like comments, mentions, etc.)
        if (entry.changes && Array.isArray(entry.changes)) {
          console.log(`[Instagram Webhook] Found ${entry.changes.length} change event(s)`);
          entry.changes.forEach((change: any, changeIndex: number) => {
            console.log(`[Instagram Webhook] Change event ${changeIndex + 1}:`, JSON.stringify(change, null, 2));
          });
        }

        // Handle mentions (if present)
        if (entry.mentions && Array.isArray(entry.mentions)) {
          console.log(`[Instagram Webhook] Found ${entry.mentions.length} mention(s)`);
          entry.mentions.forEach((mention: any, mentionIndex: number) => {
            console.log(`[Instagram Webhook] Mention ${mentionIndex + 1}:`, JSON.stringify(mention, null, 2));
          });
        }

        // Handle story mentions (if present)
        if (entry.story_mentions && Array.isArray(entry.story_mentions)) {
          console.log(`[Instagram Webhook] Found ${entry.story_mentions.length} story mention(s)`);
          entry.story_mentions.forEach((storyMention: any, storyIndex: number) => {
            console.log(`[Instagram Webhook] Story mention ${storyIndex + 1}:`, JSON.stringify(storyMention, null, 2));
          });
        }
      });
    } else {
      console.log('[Instagram Webhook] Unknown object type:', body.object);
    }

    // Always return 200 OK to acknowledge receipt
    // Instagram will retry if it doesn't receive a 200 response
    console.log('[Instagram Webhook] Processing complete, returning 200 OK');
    return new NextResponse('OK', {
      status: 200,
    });
  } catch (error) {
    console.error('='.repeat(80));
    console.error('[Instagram Webhook] POST Error caught:', error);
    
    // Log error details
    if (error instanceof Error) {
      console.error('[Instagram Webhook] Error name:', error.name);
      console.error('[Instagram Webhook] Error message:', error.message);
      console.error('[Instagram Webhook] Error stack:', error.stack);
    } else {
      console.error('[Instagram Webhook] Unknown error type:', typeof error);
      console.error('[Instagram Webhook] Error value:', error);
    }
    console.error('='.repeat(80));

    // Still return 200 to prevent Instagram from retrying
    // (or return 500 if you want Instagram to retry)
    return new NextResponse('OK', {
      status: 200,
    });
  }
}

