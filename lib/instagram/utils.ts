import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/utils/url'
import crypto from 'crypto'

const log = createLogger('Instagram:Utils')

export interface InstagramProfileMeta {
  username?: string
  display_name?: string
  profile_pic_url?: string
}

export interface MessageRow {
  id: string
  sender_ig_id: string
  recipient_ig_id: string
  message_text: string | null
  attachments: any | null
  received_at: string // Column name in database
  processed: boolean
}

export interface InstagramProfileRow {
  ig_id: string
  username: string | null
  display_name: string | null
  profile_pic_url: string | null
  connected_user_id: string | null
  connected_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Upsert Instagram profile (idempotent)
 */
export async function upsertInstagramProfile(
  igId: string,
  partialMeta?: InstagramProfileMeta
): Promise<InstagramProfileRow> {
  try {
    log.info('Creating Supabase service client for profile upsert', { igId })
    const supabase = createServiceClient()
    
    const profileData: any = {
      ig_id: igId,
      updated_at: new Date().toISOString(),
    }

    if (partialMeta?.username) profileData.username = partialMeta.username
    if (partialMeta?.display_name) profileData.display_name = partialMeta.display_name
    if (partialMeta?.profile_pic_url) profileData.profile_pic_url = partialMeta.profile_pic_url

    log.info('Upserting profile data', { igId, hasUsername: !!profileData.username })
    
    // Add timeout wrapper for database operations
    const upsertPromise = supabase
      .from('instagram_profiles')
      .upsert(profileData, {
        onConflict: 'ig_id',
        ignoreDuplicates: false,
      })
      .select()
      .single()
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database upsert timeout after 10 seconds')), 10000)
    })
    
    log.info('Starting database upsert query', { igId })
    let result
    try {
      result = await Promise.race([upsertPromise, timeoutPromise])
      log.info('Database upsert query completed', { igId })
    } catch (timeoutError: any) {
      if (timeoutError.message?.includes('timeout')) {
        log.error('Database upsert timed out', timeoutError, { igId, profileData })
        throw new Error(`Database operation timed out: ${timeoutError.message}`)
      }
      log.error('Database upsert query failed', timeoutError, { igId, errorMessage: timeoutError?.message })
      throw timeoutError
    }
    
    log.info('Parsing database upsert result', { igId, hasResult: !!result })
    const { data, error } = result as any
    log.info('Database upsert result parsed', { igId, hasData: !!data, hasError: !!error })

    if (error) {
      log.error('Failed to upsert Instagram profile', error, { 
        igId, 
        profileData, 
        errorCode: error.code, 
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      })
      throw new Error(`Failed to upsert Instagram profile: ${error.message}`)
    }

    if (!data) {
      log.error('Upsert returned no data', { igId, profileData })
      throw new Error('Upsert operation returned no data')
    }

    log.info('Profile upserted successfully', { igId, connectedUserId: data?.connected_user_id })
    return data as InstagramProfileRow
  } catch (error: any) {
    log.error('Exception in upsertInstagramProfile', error, { igId, errorMessage: error?.message, errorStack: error?.stack })
    throw error
  }
}

/**
 * Insert message if not exists (idempotent)
 */
export async function insertMessageIfNotExists(
  mid: string,
  senderIgId: string,
  recipientIgId: string,
  messageText: string | null,
  attachments: any | null,
  timestamp: string
): Promise<MessageRow> {
  const supabase = createServiceClient()

  // Instagram timestamps are in milliseconds (13 digits) or seconds (10 digits)
  // Convert to milliseconds if needed, then to ISO string
  // Ensure timestamp is a string for length check
  const timestampStr = String(timestamp).trim()
  const isMilliseconds = timestampStr.length >= 13
  const timestampMs = isMilliseconds
    ? parseInt(timestampStr, 10) // Already in milliseconds
    : parseInt(timestampStr, 10) * 1000 // Convert seconds to milliseconds
  
  // Validate the timestamp is reasonable (not in the far future/past)
  const date = new Date(timestampMs)
  if (isNaN(date.getTime()) || date.getFullYear() > 2100 || date.getFullYear() < 2020) {
    log.error('Invalid timestamp conversion', {
      originalTimestamp: timestamp,
      timestampStr,
      timestampMs,
      isMilliseconds,
      resultingDate: date.toISOString(),
    })
    throw new Error(`Invalid timestamp: ${timestamp} (converted to ${timestampMs}ms)`)
  }
  
  const messageData: any = {
    id: mid,
    sender_ig_id: senderIgId,
    recipient_ig_id: recipientIgId,
    message_text: messageText,
    received_at: new Date(timestampMs).toISOString(), // Use received_at column
    processed: false,
  }

  // Store attachments as JSONB (Supabase handles JSON conversion)
  if (attachments) {
    messageData.attachments = attachments
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single()

  // If duplicate (ON CONFLICT DO NOTHING), fetch existing
  if (error) {
    if (error.code === '23505') {
      // Duplicate key - fetch existing
      const { data: existing, error: fetchError } = await supabase
        .from('messages')
        .select()
        .eq('id', mid)
        .single()

      if (fetchError) {
        log.error('Failed to fetch existing message', fetchError, { mid })
        throw new Error(`Failed to fetch existing message: ${fetchError.message}`)
      }

      return existing as MessageRow
    }

    log.error('Failed to insert message', error, { mid })
    throw new Error(`Failed to insert message: ${error.message}`)
  }

  return data as MessageRow
}

/**
 * Create verification token (returns plaintext token, stores hash)
 */
export async function createVerificationToken(
  igId: string,
  eventId: string
): Promise<{ tokenPlain: string; tokenHash: string; expiresAt: string }> {
  const supabase = createServiceClient()

  // Generate secure random token
  const tokenPlain = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(tokenPlain).digest('hex')

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 1)

  const { data, error } = await supabase
    .from('verification_tokens')
    .insert({
      token_hash: tokenHash,
      ig_id: igId,
      expires_at: expiresAt.toISOString(),
      consumed: false,
      created_by_event_id: eventId,
    })
    .select()
    .single()

  if (error) {
    log.error('Failed to create verification token', error, { igId })
    throw new Error(`Failed to create verification token: ${error.message}`)
  }

  log.info('Verification token created', { igId, expiresAt: expiresAt.toISOString() })

  return {
    tokenPlain,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  }
}

/**
 * Send DM via Instagram API
 */
export async function sendDM(
  recipientIgId: string,
  messageText: string
): Promise<{ remoteMessageId: string }> {
  const apiBaseUrl = process.env.INSTAGRAM_API_BASE_URL
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const scopedId = process.env.INSTAGRAM_SCOPED_ID

  if (!apiBaseUrl || !accessToken || !scopedId) {
    throw new Error('Missing Instagram API configuration')
  }

  // Instagram Graph API endpoint format: /{page-id}/messages
  const url = `${apiBaseUrl}/${scopedId}/messages`
  
  const payload = {
    recipient: {
      id: recipientIgId,
    },
    message: {
      text: messageText,
    },
    messaging_type: 'RESPONSE',
  }

  log.debug('Sending DM via Instagram API', { url, recipientIgId, hasMessage: !!messageText })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    log.error('Failed to send DM', new Error(errorText), {
      recipientIgId,
      status: response.status,
    })
    throw new Error(`Instagram API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const remoteMessageId = data.message_id || data.id || 'unknown'

  log.info('DM sent successfully', { recipientIgId, remoteMessageId })

  return { remoteMessageId }
}

/**
 * Track outbound message in database
 */
export async function trackOutboundMessage(
  recipientIgId: string,
  kind: 'verification' | 'acknowledgement',
  payload: any,
  status: 'pending' | 'sent' | 'failed' = 'pending',
  remoteMessageId?: string,
  error?: string,
  attempts: number = 0
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error: insertError } = await supabase
    .from('outbound_messages')
    .insert({
      recipient_ig_id: recipientIgId,
      kind,
      payload: payload, // JSONB - Supabase handles JSON conversion
      status,
      attempts,
      remote_message_id: remoteMessageId || null,
      error: error || null,
    })
    .select('id')
    .single()

  if (insertError) {
    log.error('Failed to track outbound message', insertError, { recipientIgId, kind })
    throw new Error(`Failed to track outbound message: ${insertError.message}`)
  }

  return data.id
}

/**
 * Update outbound message status
 */
export async function updateOutboundMessage(
  messageId: string,
  updates: {
    status?: 'pending' | 'sent' | 'failed'
    remote_message_id?: string
    error?: string
    attempts?: number
  }
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('outbound_messages')
    .update(updates)
    .eq('id', messageId)

  if (error) {
    log.error('Failed to update outbound message', error, { messageId })
    throw new Error(`Failed to update outbound message: ${error.message}`)
  }
}

/**
 * Send verification DM with retry logic
 */
export async function sendVerificationDM(
  igId: string,
  tokenPlain: string
): Promise<{ remoteMessageId: string; outboundMessageId: string }> {
  const baseUrl = getBaseUrl()
  const verificationUrl = `${baseUrl}/verify?token=${encodeURIComponent(tokenPlain)}&ig_id=${encodeURIComponent(igId)}`
  const messageText = `Hey — welcome to Reeva! It looks like you haven't connected your Instagram account to Reeva yet. Click the link below to connect and view your saved reels and posts:\n\n${verificationUrl}`

  // Create outbound message tracking row
  const outboundMessageId = await trackOutboundMessage(
    igId,
    'verification',
    { text: messageText },
    'pending'
  )

  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { remoteMessageId } = await sendDM(igId, messageText)
      
      await updateOutboundMessage(outboundMessageId, {
        status: 'sent',
        remote_message_id: remoteMessageId,
        attempts: attempt,
      })

      return { remoteMessageId, outboundMessageId }
    } catch (error: any) {
      lastError = error
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff, max 10s
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      await updateOutboundMessage(outboundMessageId, {
        status: attempt === maxAttempts ? 'failed' : 'pending',
        error: error.message,
        attempts: attempt,
      })
    }
  }

  throw lastError || new Error('Failed to send verification DM after retries')
}

/**
 * Send acknowledgement DM with retry logic
 */
export async function sendAcknowledgementDM(
  igId: string
): Promise<{ remoteMessageId: string; outboundMessageId: string }> {
  const messageText = "Hi! Send your reels and posts here and we'll save them to your Reeva library."

  // Create outbound message tracking row
  const outboundMessageId = await trackOutboundMessage(
    igId,
    'acknowledgement',
    { text: messageText },
    'pending'
  )

  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { remoteMessageId } = await sendDM(igId, messageText)
      
      await updateOutboundMessage(outboundMessageId, {
        status: 'sent',
        remote_message_id: remoteMessageId,
        attempts: attempt,
      })

      return { remoteMessageId, outboundMessageId }
    } catch (error: any) {
      lastError = error
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff, max 10s
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      await updateOutboundMessage(outboundMessageId, {
        status: attempt === maxAttempts ? 'failed' : 'pending',
        error: error.message,
        attempts: attempt,
      })
    }
  }

  throw lastError || new Error('Failed to send acknowledgement DM after retries')
}

/**
 * Mark message as processed
 */
export async function markMessageAsProcessed(messageId: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('messages')
    .update({ processed: true })
    .eq('id', messageId)

  if (error) {
    log.error('Failed to mark message as processed', error, { messageId })
    throw new Error(`Failed to mark message as processed: ${error.message}`)
  }
}

/**
 * Enqueue for Phase 3 processing (abstract - no DB queue)
 */
export async function enqueueForPhase3Processing(
  messageRow: MessageRow,
  profileRow: InstagramProfileRow
): Promise<{ ok: boolean }> {
  // Abstract implementation - can be replaced with real queue later
  // For now, just log and return success
  
  log.info('Enqueuing for Phase 3 processing', {
    messageId: messageRow.id,
    senderIgId: messageRow.sender_ig_id,
    connectedUserId: profileRow.connected_user_id,
    hasAttachments: !!messageRow.attachments,
  })

  // TODO: Replace with actual queue/worker API call when Phase 3 is implemented
  // Example:
  // const queueUrl = process.env.PHASE3_QUEUE_URL
  // if (queueUrl) {
  //   await fetch(queueUrl, { method: 'POST', body: JSON.stringify({ messageRow, profileRow }) })
  // }

  return { ok: true }
}

