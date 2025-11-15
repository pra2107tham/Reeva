# Webhook Hanging Issue - Root Cause & Fix

## ✅ ISSUE RESOLVED

### Root Cause Identified

**The problem was `setImmediate()` in serverless environments.**

### Serverless Function Lifecycle

**Vercel/Serverless**:
1. Request received
2. Handler executes
3. Response sent (`return NextResponse('OK')`)
4. **⚠️ Function execution frozen/terminated immediately**
5. Any pending `setImmediate()` callbacks **never execute**
6. Result: QStash publish never happens

**Local Node.js**:
1. Request received
2. Handler executes
3. Response sent
4. **Process keeps running**
5. `setImmediate()` callbacks execute
6. QStash publish happens ✅

### Why It Worked Locally But Not in Production

- **Local**: Node.js process continues after response → `setImmediate()` runs → QStash publishes
- **Production**: Serverless function freezes after response → `setImmediate()` never runs → No publish

## The Fix

**Changed from fire-and-forget to await-with-timeout:**

1. **Removed `setImmediate()`** - This was preventing execution in serverless
2. **Added `await forwardToInternalIngestion(events)`** - Ensures publish happens before response
3. **Reduced timeout to 3 seconds** - Quick response for Instagram
4. **Used `Promise.allSettled()`** - Ensures webhook returns 200 even if publish fails

### Before (Broken)
```typescript
// Fire and forget with setImmediate - DOESN'T WORK IN SERVERLESS
Promise.resolve()
  .then(() => forwardToInternalIngestion(events))
  .catch(...)

// Inside forwardToInternalIngestion:
setImmediate(() => {
  // This never executes in serverless!
  qstash.publishJSON(...)
})
```

### After (Fixed)
```typescript
// Await before responding - WORKS IN SERVERLESS
try {
  await forwardToInternalIngestion(events)
} catch (error) {
  log.error('Failed to forward events to QStash', error)
  // Continue and return 200 anyway
}

// Inside forwardToInternalIngestion:
const publishPromises = events.map(async (event) => {
  // Publishes with 3 second timeout
  await Promise.race([qstash.publishJSON(...), timeout])
})
await Promise.allSettled(publishPromises)
```

## Key Learnings

### 1. Serverless Execution Model
- Functions freeze after response is sent
- No background processing after response
- Must complete all work before responding

### 2. Fire-and-Forget Doesn't Work
- `setImmediate()`, `process.nextTick()`, `setTimeout()` don't work
- Any unawaited promises are lost
- Must `await` critical operations

### 3. Instagram Webhook Requirements
- Expects quick responses (< 5 seconds)
- Will retry on errors or timeouts
- Best practice: publish quickly with timeout, return 200

## Previous Problem Analysis (Historical)

1. **Network Connectivity Issues in Vercel Serverless**
   - Vercel serverless functions may have network restrictions
   - Outbound HTTPS connections might be blocked or throttled
   - DNS resolution might be slow or failing
   - Connection pool exhaustion

2. **QStash API Issues**
   - QStash API endpoint might be slow or unreachable from Vercel
   - API rate limiting or throttling
   - Authentication/authorization issues (token validation hanging)

3. **Serverless Execution Context**
   - The function execution context might be waiting for all promises to resolve
   - Even "fire-and-forget" promises might block the response
   - Vercel might be keeping the function alive until all async operations complete

4. **Promise Chain Blocking**
   - The `forwardToInternalIngestion` function is `async`, which might be causing issues
   - Even though we're not awaiting it, the promise chain might be blocking

## Current Implementation

### Flow
```
Instagram Webhook → Parse Events → forwardToInternalIngestion() → 
  → setImmediate() → Fire-and-forget promise → qstash.publishJSON() → HANGS
```

### Code Location
- **Webhook Handler**: `app/api/webhooks/instagram/route.ts` (line 127-134)
- **Parser**: `lib/instagram/webhook-parser.ts` (line 82-178)
- **QStash Publish**: `lib/instagram/webhook-parser.ts` (line 120-139)

## What to Research

### 1. Vercel Serverless Network Restrictions
**Research Questions:**
- Does Vercel allow outbound HTTPS connections to external APIs?
- Are there any network restrictions or firewall rules?
- What's the timeout for outbound HTTP requests?
- Are there any DNS resolution issues?

**How to Check:**
```bash
# Test QStash API connectivity from Vercel
# Add a test endpoint that makes a simple fetch to QStash API
```

**Documentation to Review:**
- Vercel Serverless Functions documentation
- Vercel Network/Outbound connections documentation
- Vercel Function execution limits

### 2. QStash API Connectivity
**Research Questions:**
- Is QStash API reachable from Vercel's IP ranges?
- What's the typical response time for `publishJSON`?
- Are there any known issues with QStash API?
- Is the QStash URL correct? (`QSTASH_URL` env var)

**How to Check:**
```bash
# Test QStash API directly
curl -X POST https://qstash.upstash.io/v2/publish/... \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "...", "body": {...}}'
```

**Documentation to Review:**
- QStash API documentation
- QStash SDK (`@upstash/qstash`) documentation
- QStash status page / known issues

### 3. Serverless Promise Handling
**Research Questions:**
- How does Vercel handle unawaited promises?
- Does Vercel wait for all promises to resolve before terminating?
- Can we truly "fire-and-forget" in serverless environments?
- Should we use a different pattern (e.g., background jobs)?

**How to Check:**
```typescript
// Test if unawaited promises block the response
export async function POST(request: NextRequest) {
  // Start a long-running promise
  Promise.resolve().then(() => {
    return new Promise(resolve => setTimeout(resolve, 60000))
  })
  
  // Return immediately
  return NextResponse.json({ ok: true })
  // Does this return immediately or wait 60 seconds?
}
```

**Documentation to Review:**
- Vercel Serverless Functions execution model
- Next.js API Routes promise handling
- Serverless function lifecycle

### 4. QStash SDK Issues
**Research Questions:**
- Is there a bug in `@upstash/qstash` SDK?
- Does `publishJSON` have proper timeout handling?
- Are there any known issues with the SDK in serverless environments?
- Should we use a different method or configuration?

**How to Check:**
```typescript
// Test QStash SDK with explicit timeout
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

// Does this work?
```

**Documentation to Review:**
- `@upstash/qstash` GitHub issues
- QStash SDK documentation
- Serverless compatibility notes

## Recommended Investigation Steps

### Step 1: Add Comprehensive Logging
Add detailed logging around the QStash publish call to identify exactly where it hangs:

```typescript
log.info('Before QStash client creation')
const qstash = getQStashClient()
log.info('After QStash client creation')

log.info('Before publishJSON call')
const qstashPublishPromise = qstash.publishJSON({...})
log.info('After publishJSON call (promise created)')

log.info('Before Promise.race')
const messageId = await Promise.race([...])
log.info('After Promise.race')
```

### Step 2: Test QStash API Directly
Create a test endpoint that makes a direct HTTP request to QStash API (bypassing the SDK):

```typescript
// Test endpoint
export async function POST(request: NextRequest) {
  const response = await fetch('https://qstash.upstash.io/v2/publish/...', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({...}),
    signal: AbortSignal.timeout(10000), // 10 second timeout
  })
  
  return NextResponse.json({ ok: response.ok })
}
```

### Step 3: Test Network Connectivity
Add a simple test endpoint to verify outbound HTTPS connections work:

```typescript
export async function GET() {
  try {
    const response = await fetch('https://httpbin.org/get', {
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({ ok: response.ok })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### Step 4: Check QStash Environment Variables
Verify all QStash environment variables are correctly set:
- `QSTASH_TOKEN` - API token
- `QSTASH_URL` - API URL (optional, defaults to production)
- `QSTASH_CURRENT_SIGNING_KEY` - For consumer verification
- `QSTASH_NEXT_SIGNING_KEY` - For key rotation

### Step 5: Review Vercel Function Logs
Check Vercel function logs for:
- Network errors
- Timeout errors
- DNS resolution errors
- Connection errors

## Potential Solutions

### Solution 1: Use Vercel Background Functions
If promises are blocking, use Vercel's background functions feature:

```typescript
export const config = {
  runtime: 'edge',
  maxDuration: 10,
}

export async function POST(request: NextRequest) {
  // Return immediately
  const response = NextResponse.json({ ok: true })
  
  // Use background function
  request.waitUntil(forwardToInternalIngestion(events))
  
  return response
}
```

### Solution 2: Use External Queue Service
Instead of publishing from the webhook handler, use an external service:
- AWS SQS
- Google Cloud Tasks
- Redis Queue
- Database queue table

### Solution 3: Simplify QStash Publish
Remove the timeout wrapper and let QStash handle retries:

```typescript
// Minimal publish - no timeout wrapper
qstash.publishJSON({...}).catch(err => {
  log.error('QStash publish failed', err)
})
```

### Solution 4: Use QStash HTTP API Directly
Bypass the SDK and use direct HTTP calls with explicit timeout:

```typescript
const controller = new AbortController()
setTimeout(() => controller.abort(), 10000)

const response = await fetch('https://qstash.upstash.io/v2/publish/...', {
  method: 'POST',
  headers: {...},
  body: JSON.stringify({...}),
  signal: controller.signal,
})
```

## Next Steps

1. **Immediate**: Add comprehensive logging to identify exact hang point
2. **Short-term**: Test QStash API connectivity from Vercel
3. **Medium-term**: Research Vercel serverless promise handling
4. **Long-term**: Consider alternative architectures (background functions, external queues)

## Monitoring

Add monitoring to track:
- QStash publish success rate
- Publish duration
- Timeout frequency
- Error types

## Related Files

- `app/api/webhooks/instagram/route.ts` - Webhook handler
- `lib/instagram/webhook-parser.ts` - Event parser and QStash publisher
- `app/api/qstash/instagram-ingestion/route.ts` - QStash consumer endpoint
- `docs/QSTASH_SETUP.md` - QStash setup documentation

