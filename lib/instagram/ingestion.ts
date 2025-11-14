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
    const profileRow: InstagramProfileRow = await upsertInstagramProfile(event.sender_ig_id, {
      // Can extract username/display_name from event if available
    })

    // Step 2: Insert message if not exists (idempotent)
    const messageRow: MessageRow = await insertMessageIfNotExists(
      event.mid,
      event.sender_ig_id,
      event.recipient_ig_id,
      event.message_text || null,
      event.attachments || null,
      event.timestamp
    )

    // Step 3: Check if profile is connected
    if (!profileRow.connected_user_id) {
      // Unconnected user flow
      log.info('Processing unconnected user', { igId: event.sender_ig_id })

      // Create verification token
      const { tokenPlain } = await createVerificationToken(event.sender_ig_id, event.mid)

      // Send verification DM
      try {
        await sendVerificationDM(event.sender_ig_id, tokenPlain)
        log.info('Verification DM sent successfully', { igId: event.sender_ig_id })
      } catch (error: any) {
        log.error('Failed to send verification DM', error, { igId: event.sender_ig_id })
        // Continue - outbound_messages row is already tracked
      }

      // Do NOT process attachments or enqueue Phase 3 for unconnected users
      return { success: true, message: 'Verification DM sent to unconnected user' }
    } else {
      // Connected user flow
      log.info('Processing connected user', {
        igId: event.sender_ig_id,
        connectedUserId: profileRow.connected_user_id,
      })

      // Send acknowledgement DM
      try {
        await sendAcknowledgementDM(event.sender_ig_id)
        log.info('Acknowledgement DM sent successfully', { igId: event.sender_ig_id })
      } catch (error: any) {
        log.error('Failed to send acknowledgement DM', error, { igId: event.sender_ig_id })
        // Continue - outbound_messages row is already tracked
      }

      // Enqueue for Phase 3 processing
      const enqueueResult = await enqueueForPhase3Processing(messageRow, profileRow)

      if (enqueueResult.ok) {
        // Mark message as processed
        await markMessageAsProcessed(event.mid)
        log.info('Message processed and enqueued for Phase 3', { mid: event.mid })
      } else {
        log.warn('Failed to enqueue for Phase 3 processing', { mid: event.mid })
        // Don't mark as processed if enqueue failed
      }

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

