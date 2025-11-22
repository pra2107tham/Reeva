import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import { InstagramProfileRow } from './utils'

const log = createLogger('Instagram:MediaStore')

/**
 * Structured media attachment extracted from Instagram webhook
 */
export interface MediaAttachment {
  media_type: 'reel' | 'post'
  media_id: string
  url: string
  title: string | null
}

/**
 * Instagram webhook event structure (subset used for media storage)
 */
export interface IncomingMessagingEvent {
  mid: string
  sender_ig_id: string
  recipient_ig_id: string
  timestamp: string
  message_text?: string | null
  attachments?: any | null
}

/**
 * Extract media items from Instagram webhook attachments
 * Supports reels and posts, skips shares and unknown types
 */
export function extractMediaFromAttachments(attachments: any): MediaAttachment[] {
  const media: MediaAttachment[] = []

  if (!attachments || !Array.isArray(attachments)) {
    return media
  }

  for (const attachment of attachments) {
    // Skip if no type field
    if (!attachment.type) {
      log.debug('Skipping attachment without type', { attachment })
      continue
    }

    // Handle Instagram Reel
    if (attachment.type === 'ig_reel') {
      const payload = attachment.payload
      if (payload && payload.reel_video_id && payload.url) {
        media.push({
          media_type: 'reel',
          media_id: payload.reel_video_id,
          url: payload.url,
          title: payload.title || null,
        })
        log.debug('Extracted reel attachment', {
          media_id: payload.reel_video_id,
          hasTitle: !!payload.title,
        })
      } else {
        log.warn('Invalid ig_reel attachment payload', { payload })
      }
    }
    // Handle Instagram Post
    else if (attachment.type === 'ig_post') {
      const payload = attachment.payload
      if (payload && payload.ig_post_media_id && payload.url) {
        media.push({
          media_type: 'post',
          media_id: payload.ig_post_media_id,
          url: payload.url,
          title: payload.title || null,
        })
        log.debug('Extracted post attachment', {
          media_id: payload.ig_post_media_id,
          hasTitle: !!payload.title,
        })
      } else {
        log.warn('Invalid ig_post attachment payload', { payload })
      }
    }
    // Skip shares and unknown types
    else if (attachment.type === 'share') {
      log.debug('Skipping share attachment', { attachment })
    } else {
      log.debug('Skipping unknown attachment type', { type: attachment.type })
    }
  }

  return media
}

/**
 * Store media items from Instagram webhook into media_items table
 * Only processes for connected users
 * Implements duplicate detection and idempotent inserts
 */
export async function storeMediaItems(
  event: IncomingMessagingEvent,
  profileRow: InstagramProfileRow
): Promise<void> {
  // Skip if user is not connected
  if (!profileRow.connected_user_id) {
    log.debug('Skipping media storage for unconnected user', {
      igId: event.sender_ig_id,
      mid: event.mid,
    })
    return
  }

  // Extract media from attachments
  log.info('Extracting media from attachments', {
    mid: event.mid,
    igId: event.sender_ig_id,
    hasAttachments: !!event.attachments,
  })

  const mediaItems = extractMediaFromAttachments(event.attachments)

  if (mediaItems.length === 0) {
    log.debug('No media items found in attachments', {
      mid: event.mid,
      attachments: event.attachments,
    })
    return
  }

  log.info('Found media items to store', {
    mid: event.mid,
    count: mediaItems.length,
    types: mediaItems.map(m => m.media_type),
  })

  const supabase = createServiceClient()

  // Process each media item
  for (const media of mediaItems) {
    try {
      log.info('Checking for duplicate media', {
        mid: event.mid,
        mediaId: media.media_id,
        mediaType: media.media_type,
        ownerUserId: profileRow.connected_user_id,
      })

      // Check if media already exists for this user
      const { data: existing, error: selectError } = await supabase
        .from('media_items')
        .select('id, media_id')
        .eq('owner_user_id', profileRow.connected_user_id)
        .eq('media_id', media.media_id)
        .maybeSingle()

      if (selectError) {
        log.error('Failed to check for duplicate media', selectError, {
          mid: event.mid,
          mediaId: media.media_id,
        })
        // Continue to next media item
        continue
      }

      if (existing) {
        log.info('Skipping duplicate media', {
          mid: event.mid,
          mediaId: media.media_id,
          existingId: existing.id,
        })
        // Skip this media item
        continue
      }

      // Insert new media item
      log.info('Inserting media item', {
        mid: event.mid,
        mediaId: media.media_id,
        mediaType: media.media_type,
        ownerUserId: profileRow.connected_user_id,
        ownerIgId: profileRow.ig_id,
      })

      const { data: inserted, error: insertError } = await supabase
        .from('media_items')
        .insert({
          owner_user_id: profileRow.connected_user_id,
          sender_ig_id: event.sender_ig_id,
          owner_ig_id: profileRow.ig_id,
          media_type: media.media_type,
          media_id: media.media_id,
          url: media.url,
          title: media.title,
        })
        .select()
        .single()

      if (insertError) {
        // Check if it's a duplicate error (unique constraint violation)
        if (insertError.code === '23505') {
          log.info('Media item already exists (race condition)', {
            mid: event.mid,
            mediaId: media.media_id,
          })
          // Not an error - just means another request inserted it first
          continue
        }

        log.error('Failed to insert media item', insertError, {
          mid: event.mid,
          mediaId: media.media_id,
          errorCode: insertError.code,
          errorMessage: insertError.message,
        })
        // Continue to next media item
        continue
      }

      log.info('Media item stored successfully', {
        mid: event.mid,
        mediaId: media.media_id,
        mediaType: media.media_type,
        insertedId: inserted?.id,
      })
    } catch (error: any) {
      log.error('Failed to store media item', error, {
        mid: event.mid,
        mediaId: media.media_id,
        errorName: error.name,
        errorMessage: error.message,
      })
      // Continue to next media item - don't throw
    }
  }

  log.info('Media storage completed', {
    mid: event.mid,
    totalItems: mediaItems.length,
  })
}

