# Instagram Messaging Ingestion System

## Overview

This document describes the internal ingestion layer for Instagram messaging events. The system processes incoming DMs, manages Instagram profiles, sends verification/acknowledgement messages, and enqueues connected users' messages for Phase 3 processing.

## Architecture

```
Instagram Webhook → Webhook Handler → Internal Ingestion Endpoint → Event Handler → Utilities
```

1. **Webhook Handler** (`/api/webhooks/instagram`) - Receives webhooks from Instagram, parses events, forwards to internal endpoint
2. **Internal Ingestion** (`/api/internal/ingest-event`) - Validates and processes events
3. **Event Handler** (`handleIncomingMessagingEvent`) - Orchestrates the full flow
4. **Utilities** - Modular functions for profile management, message insertion, token generation, DM sending

## Endpoints

### POST `/api/internal/ingest-event`

**Authentication:** `x-service-token` header (must match `INTERNAL_SERVICE_TOKEN`)

**Request Body:**
```json
{
  "mid": "message_id_123",
  "sender_ig_id": "sender_instagram_id",
  "recipient_ig_id": "recipient_instagram_id",
  "timestamp": "1234567890",
  "message_text": "Hello!",
  "attachments": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event accepted for processing"
}
```

### POST `/api/internal/generate-verification`

**Authentication:** `x-service-token` header

**Request Body:**
```json
{
  "ig_id": "instagram_user_id",
  "event_id": "message_id_123"
}
```

**Response:**
```json
{
  "token_hash": "sha256_hash_of_token",
  "expires_at": "2025-11-13T21:00:00Z",
  "ig_id": "instagram_user_id"
}
```

**Note:** Plaintext token is never returned via API (security)

### POST `/api/internal/send-verification-dm`

**Authentication:** `x-service-token` header

**Request Body:**
```json
{
  "ig_id": "instagram_user_id",
  "token_plain": "plaintext_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "remote_message_id": "instagram_message_id",
  "outbound_message_id": "uuid"
}
```

### POST `/api/internal/send-dm`

**Authentication:** `x-service-token` header

**Request Body:**
```json
{
  "ig_id": "instagram_user_id",
  "message_text": "Your message here",
  "kind": "custom"
}
```

**Response:**
```json
{
  "success": true,
  "remote_message_id": "instagram_message_id",
  "outbound_message_id": "uuid"
}
```

## Flow Diagrams

### Unconnected User Flow

```
1. Message received → Webhook → Internal Ingestion
2. Upsert Instagram profile (connected_user_id = NULL)
3. Insert message into messages table
4. Create verification token (SHA256 hash stored, plaintext in memory)
5. Create outbound_messages row (status = 'pending')
6. Send verification DM via Instagram API
7. Update outbound_messages (status = 'sent' or 'failed')
8. Return success (no Phase 3 processing)
```

### Connected User Flow

```
1. Message received → Webhook → Internal Ingestion
2. Upsert Instagram profile (connected_user_id = set)
3. Insert message into messages table
4. Create outbound_messages row for acknowledgement (status = 'pending')
5. Send acknowledgement DM via Instagram API
6. Update outbound_messages (status = 'sent' or 'failed')
7. Enqueue for Phase 3 processing
8. Mark message as processed (processed = true)
9. Return success
```

## DM Messages

### Verification DM (Unconnected Users)

```
Hey — welcome to Reeva! It looks like you haven't connected your Instagram account to Reeva yet. Click the link below to connect and view your saved reels and posts:

https://c702be487ed4.ngrok-free.app/verify?token=<TOKEN>&ig_id=<IGID>
```

### Acknowledgement DM (Connected Users)

```
Hi! Send your reels and posts here and we'll save them to your Reeva library.
```

## Environment Variables

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Instagram API
INSTAGRAM_API_BASE_URL=https://graph.instagram.com/v24.0
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_SCOPED_ID=your_scoped_id
INSTAGRAM_WEBHOOK_VERIFICATION_TOKEN=your_webhook_token

# Internal Service
INTERNAL_SERVICE_TOKEN=your_service_token
INTERNAL_INGEST_URL=http://localhost:3000/api/internal/ingest-event
```

## Database Tables

### instagram_profiles
- `ig_id` (PK, text)
- `username`, `display_name`, `profile_pic_url`
- `connected_user_id` (FK to profiles.id)
- `connected_at`, `created_at`, `updated_at`

### verification_tokens
- `token_hash` (PK, text) - SHA256 hash of token
- `ig_id` (FK to instagram_profiles.ig_id)
- `expires_at` (timestamptz) - 1 hour from creation
- `consumed` (boolean) - single-use flag
- `created_by_event_id` (text) - message ID that triggered creation
- `created_at`

### messages
- `id` (PK, text) - Instagram message ID (mid)
- `sender_ig_id`, `recipient_ig_id`
- `message_text` (text, nullable)
- `attachments` (jsonb, nullable)
- `timestamp` (timestamptz)
- `processed` (boolean) - true when Phase 3 processing triggered
- `created_at`, `updated_at`

### outbound_messages
- `id` (PK, uuid)
- `recipient_ig_id` (text)
- `kind` (text) - 'verification' | 'acknowledgement' | 'custom'
- `payload` (jsonb) - message content
- `status` (text) - 'pending' | 'sent' | 'failed'
- `attempts` (integer) - retry count
- `remote_message_id` (text, nullable) - Instagram message ID
- `error` (text, nullable) - error message if failed
- `created_at`, `updated_at`

## Testing

### Test Case 1: Unconnected User

**Setup:**
1. Ensure Instagram profile exists with `connected_user_id = NULL`
2. Send test webhook with message from unconnected user

**Expected Results:**
- `instagram_profiles` row upserted (or existing row found)
- `messages` row inserted with `processed = false`
- `verification_tokens` row created with:
  - `token_hash` = SHA256 hash
  - `expires_at` = now() + 1 hour
  - `consumed = false`
  - `created_by_event_id` = message mid
- `outbound_messages` row created with:
  - `kind = 'verification'`
  - `status = 'sent'` (or 'failed' if API error)
  - `remote_message_id` set if successful
- No Phase 3 processing triggered
- Message `processed` remains `false`

**Manual Test:**
```bash
curl -X POST http://localhost:3000/api/internal/ingest-event \
  -H "Content-Type: application/json" \
  -H "x-service-token: your_service_token" \
  -d '{
    "mid": "test_msg_001",
    "sender_ig_id": "unconnected_user_123",
    "recipient_ig_id": "your_page_id",
    "timestamp": "1734123456",
    "message_text": "Hello"
  }'
```

### Test Case 2: Connected User

**Setup:**
1. Ensure Instagram profile exists with `connected_user_id` set to a valid user UUID
2. Send test webhook with message from connected user

**Expected Results:**
- `instagram_profiles` row upserted (or existing row found)
- `messages` row inserted with `processed = false`
- `outbound_messages` row created with:
  - `kind = 'acknowledgement'`
  - `status = 'sent'` (or 'failed' if API error)
- `enqueueForPhase3Processing` called (returns `{ ok: true }`)
- Message `processed` set to `true`

**Manual Test:**
```bash
curl -X POST http://localhost:3000/api/internal/ingest-event \
  -H "Content-Type: application/json" \
  -H "x-service-token: your_service_token" \
  -d '{
    "mid": "test_msg_002",
    "sender_ig_id": "connected_user_456",
    "recipient_ig_id": "your_page_id",
    "timestamp": "1734123456",
    "message_text": "Check this reel out!"
  }'
```

### Test Case 3: Duplicate Webhook (Idempotency)

**Setup:**
1. Send same webhook twice with identical `mid`

**Expected Results:**
- First webhook: Message inserted, processing triggered
- Second webhook: Existing message found (no duplicate), no duplicate verification token created
- `messages` table has only one row with that `mid`
- `verification_tokens` table has only one token per `ig_id` (if unconnected)

**Manual Test:**
```bash
# Send first time
curl -X POST http://localhost:3000/api/internal/ingest-event \
  -H "Content-Type: application/json" \
  -H "x-service-token: your_service_token" \
  -d '{
    "mid": "duplicate_test_001",
    "sender_ig_id": "test_user",
    "recipient_ig_id": "your_page_id",
    "timestamp": "1734123456",
    "message_text": "Test"
  }'

# Send same message again (should be idempotent)
curl -X POST http://localhost:3000/api/internal/ingest-event \
  -H "Content-Type: application/json" \
  -H "x-service-token: your_service_token" \
  -d '{
    "mid": "duplicate_test_001",
    "sender_ig_id": "test_user",
    "recipient_ig_id": "your_page_id",
    "timestamp": "1734123456",
    "message_text": "Test"
  }'
```

## Security

1. **Token Hashing:** All verification tokens are hashed with SHA256 before storage. Plaintext tokens exist only in memory during processing.

2. **Service Token:** Internal endpoints require `x-service-token` header matching `INTERNAL_SERVICE_TOKEN` environment variable.

3. **Single-Use Tokens:** Verification tokens are marked as `consumed` after use (handled by verification endpoint in Phase 2).

4. **Token Expiration:** Tokens expire after 1 hour (`expires_at` field).

5. **RLS Policies:** Database tables use Row-Level Security. Service role key bypasses RLS for writes.

## Error Handling

- **Retry Logic:** DM sending retries up to 3 times with exponential backoff (1s, 2s, 4s, max 10s)
- **Idempotency:** Message insertion uses `ON CONFLICT DO NOTHING` to prevent duplicates
- **Async Processing:** Events are processed asynchronously to avoid blocking webhook responses
- **Error Tracking:** All failures are logged and tracked in `outbound_messages.error` field

## Phase 3 Enqueue

The `enqueueForPhase3Processing` function is currently abstract:

```typescript
// Current implementation (abstract)
export async function enqueueForPhase3Processing(
  messageRow: MessageRow,
  profileRow: InstagramProfileRow
): Promise<{ ok: boolean }> {
  // Logs event and returns success
  // Can be replaced with actual queue/worker API call
  return { ok: true }
}
```

**Future Implementation:**
- Replace with actual queue service (AWS SQS, RabbitMQ, etc.)
- Or call Phase 3 worker API endpoint
- Or insert into job queue table (if implementing DB-based queue)

## Utilities Reference

### `upsertInstagramProfile(igId, partialMeta?)`
- Idempotent upsert of Instagram profile
- Returns `InstagramProfileRow`

### `insertMessageIfNotExists(mid, senderIgId, recipientIgId, messageText, attachments, timestamp)`
- Idempotent message insertion
- Uses `ON CONFLICT DO NOTHING` for duplicates
- Returns `MessageRow`

### `createVerificationToken(igId, eventId)`
- Generates secure random token (32 bytes hex)
- Hashes with SHA256 before storage
- Returns plaintext token (in memory only), hash, and expires_at

### `sendVerificationDM(igId, tokenPlain)`
- Creates outbound_messages row
- Sends DM with verification link
- Retries on failure
- Updates outbound_messages status

### `sendAcknowledgementDM(igId)`
- Creates outbound_messages row
- Sends acknowledgement message
- Retries on failure
- Updates outbound_messages status

### `sendDM(igId, messageText)`
- Generic DM sender
- Calls Instagram Graph API
- Returns remote_message_id

### `enqueueForPhase3Processing(messageRow, profileRow)`
- Abstract utility for Phase 3 processing
- Currently logs and returns success
- Replaceable with actual queue implementation

## Notes

- Webhook handler forwards parsed events to internal endpoint (does not process them directly)
- All database writes use service role key to bypass RLS
- Message attachments are stored as JSONB in PostgreSQL
- Outbound message tracking provides full audit trail of all DMs sent
- System is designed to be modular and testable

