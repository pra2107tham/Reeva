# QStash Setup for Instagram Ingestion

## Overview

This document describes the QStash implementation for processing Instagram messaging events asynchronously with automatic retries and delivery guarantees.

## Architecture

```
Instagram Webhook → Webhook Handler → Internal Ingestion Endpoint → QStash → Consumer Endpoint → Event Processing
```

## Components

### 1. Producer Endpoint (`/api/internal/ingest-event`)
- **Purpose**: Receives events from webhook handler and enqueues them to QStash
- **Function**: Uses `Client.publishJSON()` to send events to QStash
- **Consumer URL**: Constructed using `getBaseUrl()` + `/api/qstash/instagram-ingestion`
- **Fallback**: If QStash fails, falls back to direct processing

### 2. Consumer Endpoint (`/api/qstash/instagram-ingestion`)
- **Purpose**: Receives messages from QStash and processes them
- **Function**: Uses `verifySignatureAppRouter()` wrapper for automatic signature verification
- **Security**: Verifies QStash signatures to ensure messages are authentic
- **Retry Logic**: Returns 500 on failure to trigger QStash retries

### 3. Environment Variables
- `QSTASH_TOKEN` - API token for publishing messages
- `QSTASH_URL` - QStash API URL (optional, defaults to production)
- `QSTASH_CURRENT_SIGNING_KEY` - Current signing key for verification
- `QSTASH_NEXT_SIGNING_KEY` - Next signing key for key rotation (optional)

## Flow

1. **Webhook Received**: Instagram sends webhook to `/api/webhooks/instagram`
2. **Event Parsed**: Webhook handler parses and forwards to `/api/internal/ingest-event`
3. **Event Enqueued**: Internal endpoint validates and sends to QStash using `publishJSON`
4. **QStash Delivery**: QStash delivers message to consumer endpoint
5. **Signature Verified**: Consumer endpoint verifies signature using `verifySignatureAppRouter`
6. **Event Processed**: Consumer processes the event (profile upsert, message insert, DMs, Phase 3 enqueue)

## Best Practices Implemented

### 1. **Message Deduplication**
- Uses Instagram message ID (`mid`) as `deduplicationId` to prevent duplicate processing
- Format: `ig_msg_{mid}`
- QStash stores deduplication IDs for 90 days
- If the same message is enqueued again, QStash accepts but doesn't enqueue

### 2. **Retry Configuration**
- Explicitly configured `retries: 3` (default, but explicit for clarity)
- Retries use exponential backoff (QStash default)
- Retries only on transient failures (5xx responses)

### 3. **Error Handling**
- **Retryable Errors** (5xx): Network issues, timeouts, database timeouts → Triggers retries
- **Permanent Errors** (4xx): Validation errors, authentication errors → No retries
- Smart error classification prevents infinite retries on permanent failures

### 4. **Timeout Configuration**
- Set `timeout: 30` seconds for message processing
- Prevents messages from hanging indefinitely
- Ensures timely failure detection

### 5. **Logging & Monitoring**
- Label: `instagram-messaging-event` for easy filtering in QStash dashboard
- Comprehensive logging with retry count information
- Error classification logged for debugging

## Benefits

- **Reliability**: Automatic retries on failure (QStash retries on non-2xx responses)
- **Deduplication**: Prevents duplicate message processing using Instagram message IDs
- **Security**: Signature verification ensures messages are from QStash
- **Decoupling**: Webhook handler responds immediately, processing happens asynchronously
- **Scalability**: QStash handles high throughput
- **Monitoring**: QStash dashboard shows message delivery status with labels
- **Smart Retries**: Only retries transient failures, prevents infinite retries on permanent errors
- **Works Everywhere**: Works in local dev (with ngrok) and production

## URL Configuration

- **Local Dev**: Uses ngrok URL (`https://c702be487ed4.ngrok-free.app`)
- **Production**: Uses production domain from `PRODUCTION_DOMAIN` env var
- **Consumer URL**: `{baseUrl}/api/qstash/instagram-ingestion`

## Error Handling

- **QStash Failure**: Falls back to direct processing
- **Signature Verification Failure**: Returns 401 (QStash won't retry)
- **Invalid Payload**: Returns 400 (QStash won't retry - permanent failure)
- **Retryable Processing Failure**: Returns 500 (QStash will retry automatically with exponential backoff)
- **Permanent Processing Failure**: Returns 400 (QStash won't retry - prevents infinite retries)
- **Success**: Returns 200 (QStash marks as delivered)

### Error Classification
The consumer endpoint intelligently classifies errors:
- **Retryable** (5xx): Network errors, timeouts, database timeouts → Triggers retries
- **Permanent** (4xx): Validation errors, authentication errors → No retries

## Testing

1. **Local Development**: 
   - Ensure ngrok is running and URL is accessible
   - Send test webhook
   - Check logs for "Event enqueued to QStash successfully"
   - Check QStash dashboard for message status
   - Verify consumer endpoint receives and processes messages

2. **Production**:
   - Deploy to Vercel
   - Add environment variables in Vercel dashboard
   - Test end-to-end flow
   - Monitor QStash dashboard for delivery status

## Monitoring

- Check QStash dashboard at https://console.upstash.com/
- Monitor message delivery status
- Check retry attempts for failed messages
- Review application logs for processing status

## Security Notes

- Signature verification is automatic via `verifySignatureAppRouter`
- Never expose QStash token in client-side code
- Use environment variables for all credentials
- Rotate signing keys periodically

