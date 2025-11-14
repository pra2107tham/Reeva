import { createLogger } from '@/lib/logger'
import {
  upsertInstagramProfile,
  insertMessageIfNotExists,
  createVerificationToken,
  sendVerificationDM,
  sendAcknowledgementDM,
  markMessageAsProcessed,
  enqueueForPhase3Processing,
  InstagramProfileRow,
  MessageRow,
} from './utils'

const log = createLogger('Instagram:Ingestion')

export interface IncomingMessagingEvent {
  mid: string
  sender_ig_id: string
  recipient_ig_id: string
  timestamp: string
  message_text?: string | null
  attachments?: any | null
}

/**
 * Handle incoming messaging event
 * Orchestrates the full flow: profile upsert, message insertion, verification/acknowledgement, Phase 3 enqueue
 */
export async function handleIncomingMessagingEvent(
  event: IncomingMessagingEvent
): Promise<{ success: boolean; message?: string }> {
  try {
    log.info('Processing incoming messaging event', {
      mid: event.mid,
      senderIgId: event.sender_ig_id,
      recipientIgId: event.recipient_ig_id,
    })

    // Step 1: Upsert Instagram profile
    log.info('Step 1: Upserting Instagram profile', { igId: event.sender_ig_id })
    const profileRow: InstagramProfileRow = await upsertInstagramProfile(event.sender_ig_id, {
      // Can extract username/display_name from event if available
    })
    log.info('Step 1: Profile upserted successfully', {
      igId: event.sender_ig_id,
      connectedUserId: profileRow.connected_user_id,
    })

    // Step 2: Insert message if not exists (idempotent)
    log.info('Step 2: Inserting message', { mid: event.mid })
    const messageRow: MessageRow = await insertMessageIfNotExists(
      event.mid,
      event.sender_ig_id,
      event.recipient_ig_id,
      event.message_text || null,
      event.attachments || null,
      event.timestamp
    )
    log.info('Step 2: Message inserted successfully', { mid: event.mid })

    // Step 3: Check if profile is connected
    log.debug('Step 3: Checking if profile is connected', {
      igId: event.sender_ig_id,
      hasConnectedUserId: !!profileRow.connected_user_id,
    })
    
    if (!profileRow.connected_user_id) {
      // Unconnected user flow
      log.info('Processing unconnected user', { igId: event.sender_ig_id })

      // Create verification token
      log.debug('Creating verification token', { igId: event.sender_ig_id, mid: event.mid })
      const { tokenPlain } = await createVerificationToken(event.sender_ig_id, event.mid)
      log.debug('Verification token created', { igId: event.sender_ig_id })

      // Send verification DM
      log.debug('Sending verification DM', { igId: event.sender_ig_id })
      try {
        await sendVerificationDM(event.sender_ig_id, tokenPlain)
        log.info('Verification DM sent successfully', { igId: event.sender_ig_id })
      } catch (error: any) {
        log.error('Failed to send verification DM', error, { igId: event.sender_ig_id })
        // Continue - outbound_messages row is already tracked
      }

      // Do NOT process attachments or enqueue Phase 3 for unconnected users
      log.info('Unconnected user flow completed', { igId: event.sender_ig_id })
      return { success: true, message: 'Verification DM sent to unconnected user' }
    } else {
      // Connected user flow
      log.info('Processing connected user', {
        igId: event.sender_ig_id,
        connectedUserId: profileRow.connected_user_id,
      })

      // Send acknowledgement DM
      log.debug('Sending acknowledgement DM', { igId: event.sender_ig_id })
      try {
        await sendAcknowledgementDM(event.sender_ig_id)
        log.info('Acknowledgement DM sent successfully', { igId: event.sender_ig_id })
      } catch (error: any) {
        log.error('Failed to send acknowledgement DM', error, { igId: event.sender_ig_id })
        // Continue - outbound_messages row is already tracked
      }

      // Enqueue for Phase 3 processing
      log.debug('Enqueuing for Phase 3 processing', { mid: event.mid })
      const enqueueResult = await enqueueForPhase3Processing(messageRow, profileRow)
      log.debug('Phase 3 enqueue result', { mid: event.mid, ok: enqueueResult.ok })

      if (enqueueResult.ok) {
        // Mark message as processed
        log.debug('Marking message as processed', { mid: event.mid })
        await markMessageAsProcessed(event.mid)
        log.info('Message processed and enqueued for Phase 3', { mid: event.mid })
      } else {
        log.warn('Failed to enqueue for Phase 3 processing', { mid: event.mid })
        // Don't mark as processed if enqueue failed
      }

      log.info('Connected user flow completed', { igId: event.sender_ig_id })
      return { success: true, message: 'Message processed for connected user' }
    }
  } catch (error: any) {
    log.error('Failed to handle incoming messaging event', error, {
      mid: event.mid,
      senderIgId: event.sender_ig_id,
    })
    throw error
  }
}

