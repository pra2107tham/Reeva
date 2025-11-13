import { NextRequest, NextResponse } from 'next/server';

/**
 * Instagram Graph API Webhook Handler
 * 
 * Handles webhook verification and event notifications from Instagram Graph API
 * 
 * GET: Webhook verification (Instagram sends hub.mode, hub.challenge, hub.verify_token)
 * POST: Webhook event notifications
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
    const body = await request.json();
    
    // Log the complete webhook payload
    console.log('='.repeat(80));
    console.log('[Instagram Webhook] Event received at:', new Date().toISOString());
    console.log('[Instagram Webhook] Full payload:', JSON.stringify(body, null, 2));
    console.log('='.repeat(80));

    // Instagram webhooks typically have this structure:
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
    return new NextResponse('OK', {
      status: 200,
    });
  } catch (error) {
    console.error('[Instagram Webhook] POST Error:', error);
    
    // Log error details
    if (error instanceof Error) {
      console.error('[Instagram Webhook] Error message:', error.message);
      console.error('[Instagram Webhook] Error stack:', error.stack);
    }

    // Still return 200 to prevent Instagram from retrying
    // (or return 500 if you want Instagram to retry)
    return new NextResponse('OK', {
      status: 200,
    });
  }
}

