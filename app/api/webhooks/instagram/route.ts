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
  const receivedAt = new Date().toISOString();
  console.log(`\n[Instagram Webhook] === Webhook received at ${receivedAt} ===`);
  
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
        console.log('[Instagram Webhook] Payload received:', JSON.stringify(body, null, 2));
      } catch (parseError) {
        console.error('[Instagram Webhook] JSON parse error:', parseError);
        console.error('[Instagram Webhook] Raw body:', rawBody);
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
      console.log('[Instagram Webhook] Type: Test webhook');
      console.log(`[Instagram Webhook] Field: ${body.field}`);
      console.log(`[Instagram Webhook] Sender ID: ${value.sender?.id || 'N/A'}`);
      console.log(`[Instagram Webhook] Recipient ID: ${value.recipient?.id || 'N/A'}`);
      if (value.timestamp) {
        const timestamp = new Date(parseInt(value.timestamp) * 1000).toISOString();
        console.log(`[Instagram Webhook] Timestamp: ${value.timestamp} (${timestamp})`);
      }
      if (value.message) {
        console.log(`[Instagram Webhook] Message ID: ${value.message.mid || 'N/A'}`);
        console.log(`[Instagram Webhook] Message Text: ${value.message.text || 'N/A'}`);
      }
      console.log('[Instagram Webhook] === End of webhook ===\n');
      return new NextResponse('OK', {
        status: 200,
      });
    }
    
    // Handle actual Instagram webhook format
    if (body.object === 'instagram') {
      console.log('[Instagram Webhook] Type: Instagram webhook');
      const entries = body.entry || [];
      console.log(`[Instagram Webhook] Total entries: ${entries.length}`);

      entries.forEach((entry: any, index: number) => {
        console.log(`\n[Instagram Webhook] --- Entry ${index + 1} ---`);
        console.log(`[Instagram Webhook] Entry ID: ${entry.id || 'N/A'}`);
        if (entry.time) {
          const entryTime = new Date(entry.time).toISOString();
          console.log(`[Instagram Webhook] Entry Time: ${entry.time} (${entryTime})`);
        }

        // Handle messaging events
        if (entry.messaging && Array.isArray(entry.messaging)) {
          console.log(`[Instagram Webhook] Messaging events: ${entry.messaging.length}`);
          entry.messaging.forEach((msg: any, msgIndex: number) => {
            console.log(`  [Message ${msgIndex + 1}]`);
            console.log(`    Full message JSON:`, JSON.stringify(msg, null, 4));
            console.log(`    Sender ID: ${msg.sender?.id || 'N/A'}`);
            console.log(`    Recipient ID: ${msg.recipient?.id || 'N/A'}`);
            if (msg.timestamp) {
              const msgTime = new Date(msg.timestamp).toISOString();
              console.log(`    Timestamp: ${msg.timestamp} (${msgTime})`);
            }
            
            // Handle different message types
            if (msg.message) {
              console.log(`    Message ID: ${msg.message.mid || 'N/A'}`);
              
              // Text message
              if (msg.message.text) {
                console.log(`    Type: Text`);
                console.log(`    Text: ${msg.message.text}`);
              }
              
              // Attachments (images, videos, audio, files, etc.)
              if (msg.message.attachments && Array.isArray(msg.message.attachments)) {
                console.log(`    Type: Attachment(s)`);
                console.log(`    Attachments count: ${msg.message.attachments.length}`);
                msg.message.attachments.forEach((attachment: any, attIndex: number) => {
                  console.log(`      [Attachment ${attIndex + 1}]`);
                  console.log(`        Type: ${attachment.type || 'N/A'}`);
                  if (attachment.payload) {
                    console.log(`        Payload:`, JSON.stringify(attachment.payload, null, 4));
                  }
                });
              }
              
              // Quick replies
              if (msg.message.quick_reply) {
                console.log(`    Type: Quick Reply`);
                console.log(`    Quick Reply:`, JSON.stringify(msg.message.quick_reply, null, 4));
              }
              
              // Reply to (if replying to another message)
              if (msg.message.reply_to) {
                console.log(`    Type: Reply`);
                console.log(`    Reply To:`, JSON.stringify(msg.message.reply_to, null, 4));
              }
              
              // Share (if sharing a post/story)
              if (msg.message.share) {
                console.log(`    Type: Share`);
                console.log(`    Share:`, JSON.stringify(msg.message.share, null, 4));
              }
              
              // If no recognized type, log the full message object
              if (!msg.message.text && !msg.message.attachments && !msg.message.quick_reply && !msg.message.reply_to && !msg.message.share) {
                console.log(`    Type: Unknown/Other`);
                console.log(`    Full message data:`, JSON.stringify(msg.message, null, 4));
              }
            }
            
            // Handle postback (button clicks)
            if (msg.postback) {
              console.log(`    Type: Postback`);
              console.log(`    Postback:`, JSON.stringify(msg.postback, null, 4));
            }
            
            // Handle reaction
            if (msg.reaction) {
              console.log(`    Type: Reaction`);
              console.log(`    Reaction:`, JSON.stringify(msg.reaction, null, 4));
            }
            
            // Handle read receipt
            if (msg.read) {
              console.log(`    Type: Read Receipt`);
              console.log(`    Read:`, JSON.stringify(msg.read, null, 4));
            }
            
            // Handle delivery receipt
            if (msg.delivery) {
              console.log(`    Type: Delivery Receipt`);
              console.log(`    Delivery:`, JSON.stringify(msg.delivery, null, 4));
            }
          });
        }

        // Handle changes events (comments, mentions, etc.)
        if (entry.changes && Array.isArray(entry.changes)) {
          console.log(`[Instagram Webhook] Change events: ${entry.changes.length}`);
          entry.changes.forEach((change: any, changeIndex: number) => {
            console.log(`  [Change ${changeIndex + 1}]`);
            console.log(`    Field: ${change.field || 'N/A'}`);
            console.log(`    Value: ${JSON.stringify(change.value, null, 2)}`);
          });
        }

        // Handle mentions
        if (entry.mentions && Array.isArray(entry.mentions)) {
          console.log(`[Instagram Webhook] Mentions: ${entry.mentions.length}`);
          entry.mentions.forEach((mention: any, mentionIndex: number) => {
            console.log(`  [Mention ${mentionIndex + 1}]`);
            console.log(`    Media ID: ${mention.media_id || 'N/A'}`);
            console.log(`    User ID: ${mention.user_id || 'N/A'}`);
          });
        }

        // Handle story mentions
        if (entry.story_mentions && Array.isArray(entry.story_mentions)) {
          console.log(`[Instagram Webhook] Story mentions: ${entry.story_mentions.length}`);
          entry.story_mentions.forEach((storyMention: any, storyIndex: number) => {
            console.log(`  [Story Mention ${storyIndex + 1}]`);
            console.log(`    Media ID: ${storyMention.media_id || 'N/A'}`);
            console.log(`    User ID: ${storyMention.user_id || 'N/A'}`);
          });
        }
      });
    } else if (body.object) {
      console.log(`[Instagram Webhook] Unknown object type: ${body.object}`);
    } else {
      console.log('[Instagram Webhook] No recognized webhook format detected');
    }
    
    console.log('[Instagram Webhook] === End of webhook ===\n');
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

