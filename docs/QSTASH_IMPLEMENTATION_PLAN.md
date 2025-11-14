# Upstash QStash Implementation Plan

## Overview
Replace direct processing with Upstash QStash for reliable, asynchronous event processing with automatic retries and delivery guarantees.

## Architecture

```
Instagram Webhook → Webhook Handler → Internal Ingestion Endpoint → QStash → Consumer Endpoint → Event Processing
```

## Step-by-Step Implementation Plan

### Phase 1: Setup & Configuration

#### 1.1 Sign Up & Get Credentials
1. **Sign up for Upstash QStash**
   - Go to https://upstash.com/
   - Create account or sign in
   - Navigate to QStash dashboard

2. **Get Required Credentials**
   - `QSTASH_TOKEN` - API token for publishing messages
   - `QSTASH_CURRENT_SIGNING_KEY` - For verifying message signatures
   - `QSTASH_NEXT_SIGNING_KEY` - For key rotation (optional but recommended)

3. **Add to Environment Variables**
   ```bash
   # .env.local (for local dev)
   QSTASH_TOKEN=your_qstash_token_here
   QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key_here
   QSTASH_NEXT_SIGNING_KEY=your_next_signing_key_here
   ```

#### 1.2 Install Package
```bash
npm install @upstash/qstash
```

### Phase 2: Implementation

#### 2.1 Update Producer Endpoint (`/api/internal/ingest-event`)
- Replace direct processing with QStash `publishJSON`
- Use public URL for consumer endpoint (production URL or ngrok for local dev)
- Return immediately after enqueuing

**Key Changes:**
- Import `Client` from `@upstash/qstash`
- Create QStash client instance
- Use `publishJSON({ url, body })` to enqueue events
- Handle errors gracefully with fallback

#### 2.2 Create Consumer Endpoint (`/api/qstash/instagram-ingestion`)
- New endpoint to receive QStash messages
- Use `verifySignatureAppRouter` to verify message authenticity
- Process events using existing `handleIncomingMessagingEvent`
- Return success/error responses

**Key Features:**
- Signature verification (security)
- Error handling with automatic retries
- Proper logging

#### 2.3 URL Configuration
- Production: Use production domain
- Local Dev: Use ngrok URL (`https://c702be487ed4.ngrok-free.app`)
- Update `getBaseUrl()` utility if needed

### Phase 3: Testing

#### 3.1 Local Development
- Use ngrok URL for consumer endpoint
- Test message publishing
- Verify consumer receives and processes messages
- Check QStash dashboard for message logs

#### 3.2 Production Deployment
- Deploy to Vercel
- Add environment variables in Vercel dashboard
- Update consumer URL to production domain
- Test end-to-end flow

### Phase 4: Monitoring & Optimization

#### 4.1 Monitoring
- Check QStash dashboard for message delivery status
- Monitor retry attempts
- Check application logs for processing status

#### 4.2 Error Handling
- QStash automatically retries on non-2xx responses
- Implement proper error responses in consumer
- Log failures for debugging

## Files to Create/Modify

### New Files:
1. `app/api/qstash/instagram-ingestion/route.ts` - Consumer endpoint

### Modified Files:
1. `app/api/internal/ingest-event/route.ts` - Producer endpoint
2. `lib/utils/url.ts` - Add QStash consumer URL helper (if needed)
3. `.env.local` - Add QStash credentials
4. `package.json` - Add `@upstash/qstash` dependency

### Documentation:
1. `docs/QSTASH_SETUP.md` - Setup and configuration guide

## Benefits Over Direct Processing

1. **Reliability**: Automatic retries on failure
2. **Decoupling**: Webhook responds immediately, processing happens async
3. **Scalability**: Handles high throughput
4. **Monitoring**: QStash dashboard shows message status
5. **Security**: Signature verification ensures messages are from QStash
6. **Works Everywhere**: Works in local dev (with ngrok) and production

## Security Considerations

- Always verify signatures using `verifySignatureAppRouter`
- Never expose QStash token in client-side code
- Use environment variables for all credentials
- Rotate signing keys periodically

## Cost Considerations

- QStash has a free tier with generous limits
- Check pricing at https://upstash.com/pricing
- Monitor usage in QStash dashboard

## Next Steps

1. Sign up for Upstash QStash account
2. Get credentials from dashboard
3. Install package
4. Implement producer endpoint changes
5. Create consumer endpoint
6. Test locally with ngrok
7. Deploy to production
8. Monitor and optimize

