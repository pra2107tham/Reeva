# Vercel Queue Setup for Instagram Ingestion

## Overview

This document describes the Vercel Queue implementation for processing Instagram messaging events asynchronously in a serverless environment.

## Architecture

```
Instagram Webhook → Webhook Handler → Internal Ingestion Endpoint → Vercel Queue → Queue Consumer → Event Processing
```

## Components

### 1. Queue Producer (`/api/internal/ingest-event`)
- **Purpose**: Receives events from webhook handler and enqueues them
- **Function**: Uses `send()` to push events to the `instagram-ingestion` topic
- **Fallback**: If queue fails, falls back to direct processing (fire-and-forget)

### 2. Queue Consumer (`/api/queues/instagram-ingestion`)
- **Purpose**: Processes events from the queue
- **Function**: Uses `handleCallback()` to automatically route messages based on topic and consumer group
- **Configuration**: Defined in `vercel.json` with consumer settings

### 3. Configuration (`vercel.json`)
- **Topic**: `instagram-ingestion`
- **Consumer Group**: `instagram-ingestion-consumer`
- **Consumer URL**: `/api/queues/instagram-ingestion`
- **Batch Settings**: 
  - `maxBatchSize`: 10 messages per batch
  - `maxBatchTimeout`: 5 seconds

## Flow

1. **Webhook Received**: Instagram sends webhook to `/api/webhooks/instagram`
2. **Event Parsed**: Webhook handler parses and forwards to `/api/internal/ingest-event`
3. **Event Enqueued**: Internal endpoint validates and sends to Vercel Queue
4. **Queue Processing**: Vercel Queue calls consumer endpoint when messages are available
5. **Event Processed**: Consumer processes the event (profile upsert, message insert, DMs, Phase 3 enqueue)

## Benefits

- **Reliability**: Events are persisted in the queue, preventing loss if serverless function terminates
- **Scalability**: Queue handles high throughput (up to 1,000 messages/second per topic)
- **Retry Logic**: Automatic retries for failed messages
- **Decoupling**: Webhook handler responds immediately, processing happens asynchronously

## Environment Variables

No additional environment variables needed - Vercel Queue uses automatic OIDC authentication.

## Deployment Notes

1. Ensure `vercel.json` is in the project root
2. Queue consumer endpoint must be accessible at `/api/queues/instagram-ingestion`
3. Consumer group name must match in both code and `vercel.json`

## Monitoring

- Check Vercel Dashboard → Queues section for queue metrics
- Monitor consumer endpoint logs for processing status
- Failed messages are automatically retried by Vercel Queue

